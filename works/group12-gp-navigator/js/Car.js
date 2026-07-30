/**
 * ════════════════════════════════════════════════════════════════
 *  Car.js — F1 赛车物理引擎
 *
 *  【F1专业系统科普】
 *
 *  1) DRS (Drag Reduction System) — 可变尾翼系统
 *     尾翼上层挡板电动抬起 → 减小空气阻力 → 提升直线速度
 *     仅在指定直道区域(DRS区)、距前车≤1秒时激活
 *     激活后下压力降低35%、风阻降低20%、极速提升约15km/h
 *     弯道抓地力下降（无DRS补偿）
 *
 *  2) 轮胎配方策略 (Soft/Medium/Hard)
 *     软胎: grip+30%, wearRate:8 — 圈速最快但磨损极快
 *     中性胎: grip+15%, wearRate:4 — 平衡之选
 *     硬胎: grip+0%, wearRate:1.5 — 超长续航
 *     磨损>80%时轮胎冒烟，抓地力显著下降
 *
 *  3) 进站换胎 / Undercut / Overcut 战术
 *     Undercut = 提前进站换新胎，利用新胎速度追旧胎对手
 *     Overcut = 晚进站，利用旧胎多跑圈数，进站后反超
 *     AI根据轮胎磨损阈值 + 随机偏移决定进站时机
 *
 *  4) 维修区限速罚时
 *     维修通道强制60km/h限速
 *     超速时累积 penaltyTime 到总比赛时间
 *
 *  【物理参数】
 *     mass=798kg (F1最低质量标准)
 *     dragBase=0.7 (基础风阻系数)
 *     downforceBase=2.5 (基础空气下压力)
 *     engineMax=330km/h (极速)
 * ════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';

/**
 * F1Car — 赛车类
 * @param {Object} opts
 * @param {boolean} opts.isPlayer 是否玩家操控
 * @param {number} opts.color     车漆颜色
 * @param {string} opts.driverName 车手名称
 * @param {number} opts.skill     AI技能值 0~1（AI专用）
 * @param {string} opts.tire      起始轮胎配方 soft/medium/hard
 */
export class F1Car {
  constructor(opts = {}) {
    this.isPlayer = !!opts.isPlayer;
    this.color = opts.color || 0xe03030;
    this.driverName = opts.driverName || 'DRV';
    this.skill = typeof opts.skill === 'number' ? opts.skill : 0.7;

    // ─── 轮胎配方参数表 ───
    this.tireConfigs = {
      soft:   { grip: 1.30, wearRate: 8,  label: '软胎', color: '#ff6b6b' },
      medium: { grip: 1.15, wearRate: 4,  label: '中性胎', color: '#ffd93d' },
      hard:   { grip: 1.00, wearRate: 1.5, label: '硬胎', color: '#d0d0d0' },
    };
    this.tireCompound = opts.tire || 'medium';
    this.curTire = this.tireConfigs[this.tireCompound];
    this.tireWear = [0, 0, 0, 0]; // 四轮独立磨损 0~100
    this.gripMod = 1;              // 抓地力修正系数 (0.4~1.3)

    // ─── 物理参数 ───
    this.mass = 798;               // kg
    this.dragBase = 0.7;           // 基础风阻系数
    this.downforceBase = 2.5;      // 基础空气下压力
    this.enginePower = 0;          // 当前引擎出力 0~1
    this.speed = 0;                // 当前速度 km/h
    this.maxSpeed = 330;           // 极速 km/h
    this.trackProgress = 0;        // 赛道进度 0~1
    this.lapCount = 0;             // 已完成圈数
    this.raceTime = 0;             // 比赛总用时 (秒)
    this.lapStartTime = 0;         // 当前圈开始时间
    this.bestLap = Infinity;       // 最快圈速
    this.pitStops = 0;             // 进站次数
    this.drsOvertakes = 0;         // DRS超车次数
    this.penaltyTime = 0;          // 罚时累积

    // ─── DRS ───
    this.drsOpen = false;           // DRS是否开启
    this.drsCooldown = 0;           // DRS冷却计时

    // ─── 维修区 ───
    this.inPitLane = false;
    this.pitting = false;           // 是否正在进站
    this.pitTimer = 0;              // 进站倒计时
    this.pitCompleted = false;      // 进站是否完成

    // ─── 状态 ───
    this.dnf = false;
    this.position = new THREE.Vector3();
    this.rotation = { y: 0 };
    this.steerAngle = 0;            // 当前转向角
    this.prevTrackProgress = 0;     // 上一帧赛道进度（圈判定用）
    this.fuel = 100;                // 燃油 0~100
    this._isNewLapBest = false;     // 当前圈是否为最快圈

    // ─── 横向偏移物理（解决穿模问题） ───
    this.lateralOffset = 0;         // 距赛道中心线偏移量 (-trackHalf~+trackHalf)
    this.lateralSpeed = 0;          // 横向移动速度
    this.trackHalfWidth = 2.7;        // 赛道半宽（基础6/2-0.3，弯道动态加宽）
    this.atBarrier = false;         // 是否撞到护栏
    this.barrierBounce = 0;         // 护栏反弹计时器

    // ─── AI ───
    this.aiThrottle = 0.6;
    this.aiBrake = 0;
    this.aiSteer = 0;
    this.aiPitThreshold = 50 + Math.random() * 30;  // AI进站磨损阈值

    // ─── 3D模型引用 ───
    this.model = null;
    this.rearWing = null;     // DRS尾翼上层板
    this.drsPlate = null;     // DRS活动板
    this._tireMeshes = [];    // 轮胎模型数组
  }

  /**
   * 创建赛车3D模型
   * 分层材质模拟PBR效果：金属车漆、碳纤维尾翼、橡胶轮胎
   */
  createModel(scene) {
    const g = new THREE.Group();

    // ─── 车身（金属车漆，PBR效果） ───
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.12,
      metalness: 0.85,
      envMapIntensity: 1.0,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 1.8), bodyMat);
    body.position.y = 0.16;
    body.castShadow = true;
    g.add(body);

    // 车身中段收窄
    const midMat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.15,
      metalness: 0.8,
    });
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.6), midMat);
    mid.position.set(0, 0.15, -0.3);
    g.add(mid);

    // ─── 鼻锥（前部锥体） ───
    const noseMat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.1,
      metalness: 0.9,
    });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 8), noseMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.18, 1.1);
    g.add(nose);

    // ─── 尾翼（含DRS可动组件） — 碳纤维材质 ───
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.25,
      metalness: 0.5,
    });
    // 固定尾翼
    const rw = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.03, 0.15), wingMat);
    rw.position.set(0, 0.38, -1.0);
    rw.userData.isDRS = true;
    this.rearWing = rw;
    g.add(rw);

    // DRS活动板（上层可抬起）
    const drsMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.2,
      metalness: 0.6,
    });
    const dp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.015, 0.1), drsMat);
    dp.position.set(0, 0.44, -1.0);
    dp.userData.isDRS = true;
    this.drsPlate = dp;
    g.add(dp);

    // ─── 前翼 ───
    const frontWing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.015, 0.08), wingMat);
    frontWing.position.set(0, 0.10, 1.18);
    g.add(frontWing);

    // ─── 轮胎（4个） ───
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.95,
      metalness: 0,
    });
    const tirePositions = [
      [-0.38, 0.08, 0.55],
      [0.38, 0.08, 0.55],
      [-0.38, 0.08, -0.55],
      [0.38, 0.08, -0.55],
    ];
    tirePositions.forEach((p) => {
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.13, 0.06, 12),
        tireMat
      );
      tire.rotation.z = Math.PI / 2;
      tire.position.set(p[0], p[1], p[2]);
      g.add(tire);
      this._tireMeshes.push(tire);
    });

    // ─── Halo（钛合金 halo 结构） ───
    const haloMat = new THREE.MeshStandardMaterial({
      color: 0x999999,
      roughness: 0.3,
      metalness: 0.8,
    });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.012, 6, 20), haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 0.48, 0.25);
    g.add(halo);

    // ─── 前灯DRL（日间行车灯） ───
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff4400,
      emissiveIntensity: 0.5,
    });
    [-0.15, 0.15].forEach((x) => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), lightMat);
      l.position.set(x, 0.15, 0.98);
      g.add(l);
    });

    // ─── 尾灯 ───
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
    });
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), tailMat);
    tl.position.set(0, 0.15, -0.98);
    g.add(tl);

    this.model = g;
    scene.add(g);
  }

  /**
   * 物理更新（核心函数，每帧调用）
   * @param {number} dt             帧时间差 (秒)
   * @param {Track} track           赛道对象
   * @param {F1Input} input         输入系统（玩家用）
   * @param {F1Car|null} playerRef 玩家赛车引用（AI用）
   */
  update(dt, track, input, playerRef) {
    if (this.dnf) {
      this.speed *= 0.9;
      return;
    }
    if (this.pitting) {
      this.speed = 0;
      this.pitTimer -= dt;
      if (this.pitTimer <= 0) this._completePit();
      return;
    }

    // ─── 输入获取 ───
    let throttle = 0;
    let brake = 0;
    if (this.isPlayer) {
      throttle = input.throttle();
      brake = input.brake();
      // 玩家主动刹车时解除自动油门
      if (brake > 0.5) input.disableAutoThrottle();
    } else {
      this._updateAI(dt, track, playerRef);
      throttle = this.aiThrottle;
      brake = this.aiBrake;
    }

    const t = this.trackProgress;

    // ─── 引擎出力 (带惯性延迟) ───
    this.enginePower = this._lerp(this.enginePower, throttle, dt * 8);
    const engineMax = this.isPlayer ? 330 : 310;
    const driveForce = this.enginePower * engineMax;

    // ─── 刹车力 ───
    const brakeForce = brake * 650;

    // ─── 空气阻力 (DRS开启时降低20%) ───
    const dragMul = this.drsOpen ? 0.80 : 1.0;
    const drag = this.dragBase * dragMul * this.speed * 0.004;

    // ─── 空气下压力 (DRS开启时降低35%) ───
    const dfMul = this.drsOpen ? 0.65 : 1.0;
    const downforce = this.downforceBase * dfMul * this.speed * 0.002;

    // ─── 轮胎抓地力修正 ───
    const wearAvg = this.tireWear.reduce((a, b) => a + b, 0) / 4;
    this.gripMod = this._clamp(1 - wearAvg / 120, 0.4, 1) * this.curTire.grip;

    // ─── 加速度计算 ───
    const accel = driveForce - brakeForce - drag - downforce;
    this.speed = this._clamp(this.speed + accel * dt * 0.15, 0, this.maxSpeed + (this.drsOpen ? 15 : 0));

    // ─── 转向（带速度阻尼：高速时转向响应更柔和） ───
    let steerTarget = 0;
    if (this.isPlayer) {
      // 低速最大0.5，高速收窄到0.1，让转向更平顺自然
      steerTarget = input.steer() * this._clamp(0.50 - this.speed / 800, 0.10, 0.50);
    } else {
      steerTarget = this.aiSteer;
      steerTarget *= (0.5 + this.skill * 0.5);
    }
    this.steerAngle = this._lerp(this.steerAngle, steerTarget, dt * (this.isPlayer ? 4 : 3));

    // ─── 横向偏移物理 ───
    // 转向角产生横向速度，响应更柔和自然
    const latSpeedTarget = this.steerAngle * this.speed * 0.10 * this.gripMod;
    this.lateralSpeed = this._lerp(this.lateralSpeed, latSpeedTarget, dt * 3);
    this.lateralOffset += this.lateralSpeed * dt;

    // 赛道边界限制（弯道动态加宽）+ 碰撞检测
    const halfW = track && track.getHalfWidthAt ?
      track.getHalfWidthAt(this.trackProgress) - 0.3 : this.trackHalfWidth;
    if (this.lateralOffset > halfW) {
      this.lateralOffset = halfW;
      this._barrierHit(dt);
    } else if (this.lateralOffset < -halfW) {
      this.lateralOffset = -halfW;
      this._barrierHit(dt);
    }

    // 反弹计时器衰减
    if (this.barrierBounce > 0) this.barrierBounce -= dt;

    // ─── 障碍物碰撞检测（领奖台/维修区建筑等立体结构） ───
    const latX = this.position.x;
    const latZ = this.position.z;
    if (track && track.checkObstacleCollision(latX, latZ)) {
      // 撞到立体建筑：大幅减速 + 推开
      this.speed *= 0.5;
      this._barrierHit(dt);
      // 把赛车推回赛道方向
      this.lateralOffset *= 0.6;
    }

    // ─── 赛道前进 ───
    const spdNormalized = this.speed / 600;
    // 抓地力不足时打滑减速
    const gripFactor = this.gripMod;
    const drsSpeedBoost = this.drsOpen ? 1.06 : 1.0;
    const progressDelta = spdNormalized * dt * 0.12 * gripFactor * drsSpeedBoost;
    this.prevTrackProgress = this.trackProgress;
    this.trackProgress = (((this.trackProgress + progressDelta) % 1) + 1) % 1;

    // ─── 圈判定 ───
    this._isNewLapBest = false;
    if (track.lapPassed(this.prevTrackProgress, this.trackProgress)) {
      this.lapCount++;
      if (this.lapCount > 1 && this.lapStartTime < 999) {
        const lapTime = this.raceTime - this.lapStartTime;
        if (lapTime < this.bestLap) {
          this.bestLap = lapTime;
          this._isNewLapBest = true;
        }
      }
      this.lapStartTime = this.raceTime;
    }

    // ─── 轮胎磨损（与速度和轮胎配方相关） ───
    const wearRate = this.curTire.wearRate * dt * (this.speed / 200 + 0.5);
    for (let i = 0; i < 4; i++) {
      this.tireWear[i] = this._clamp(
        this.tireWear[i] + wearRate * (0.85 + Math.random() * 0.3),
        0, 100
      );
    }

    // ─── 燃油消耗（仅玩家记录，AI算在raceTime里） ───
    if (this.isPlayer) {
      this.fuel = Math.max(0, this.fuel - throttle * dt * 0.06);
    }

    // ─── DRS冷却 ───
    if (this.drsCooldown > 0) this.drsCooldown -= dt;

    // ─── 维修区检测与限速 ───
    const pos = track.getPointAt(this.trackProgress);
    this.inPitLane = track.isPitLane(pos);
    if (this.inPitLane) {
      // 维修区强制限速60km/h，超速罚时
      if (this.speed > 60) {
        this.speed = this._lerp(this.speed, 55, dt * 4);
        this.penaltyTime += dt * 0.5;  // 超速每秒罚0.5秒
      }
    }

    // ─── AI进站决策 ───
    if (!this.isPlayer && !this.pitting && this.lapCount > 1) {
      if (wearAvg > this.aiPitThreshold) {
        // 随机进站避免AI同时进站
        if (Math.random() < 0.005) this.startPit();
      }
    }

    // ─── 更新位置与旋转 ───
    const latPos = this.getPos(track);
    this.position.copy(latPos);
    const tang = track.getTangentAt(this.trackProgress);
    // 车身朝向 = 赛道方向 + 轻柔转向偏移，去掉自旋的latYaw
    this.rotation.y = Math.atan2(-tang.x, -tang.z) + this.steerAngle * 0.15;

    // ─── 3D模型更新 ───
    this._updateModel(dt);

    // ─── 比赛时间 ───
    this.raceTime += dt;
  }

  /**
   * 更新3D模型位置/旋转/DRS动画/轮胎旋转
   */
  _updateModel(dt) {
    if (!this.model) return;

    this.model.position.copy(this.position);
    this.model.position.y = 0;
    this.model.rotation.y = this.rotation.y;

    // DRS尾翼板动画
    if (this.drsPlate) {
      // DRS开启时板抬起约35度（弧度0.6）
      this.drsPlate.rotation.x = this.drsOpen ? 0.6 : 0;
    }
    if (this.rearWing) {
      this.rearWing.rotation.x = this.drsOpen ? 0.25 : 0;
    }

    // 轮胎旋转动画（随速度旋转）
    const rotSpeed = this.speed * dt * 0.6;
    this._tireMeshes.forEach((tire) => {
      if (tire) tire.rotation.x += rotSpeed;
    });

    // 高速时车身下压（空气动力学效果）
    if (this.speed > 100 && this.model) {
      this.model.position.y = -this.speed * 0.0001;
    }
  }

  /**
   * 进站开始
   */
  startPit() {
    if (this.pitting) return;
    this.pitting = true;
    this.pitTimer = 2.5;  // 进站耗时2.5秒
    this.pitStops++;

    // 换轮胎策略：随机换一种
    const compounds = ['soft', 'medium', 'hard'];
    const newCompound = compounds[Math.floor(Math.random() * 3)];
    this.tireCompound = newCompound;
    this.curTire = this.tireConfigs[newCompound];
    this.tireWear = [0, 0, 0, 0];  // 新胎零磨损

    this.pitCompleted = false;
  }

  /**
   * 进站完成
   */
  _completePit() {
    this.pitting = false;
    this.pitCompleted = true;
    this.speed = 40;  // 出站速度
  }

  /**
   * 护栏碰撞处理
   * 撞墙减速 + 横向速度归零 + 反弹效果
   */
  _barrierHit(dt) {
    // 撞墙处理：柔和减速，不弹飞赛车
    if (!this.atBarrier) {
      this.atBarrier = true;
      this.speed *= 0.60;  // 撞墙减速40%
      this.lateralSpeed *= 0.1;  // 几乎取消反弹，避免车自己歪头
      this.barrierBounce = 0.2;
    }
    if (this.barrierBounce <= 0) {
      this.speed *= 0.95;
    }
  }

  /**
   * 获取赛道实际位置（含横向偏移，解决穿模问题）
   */
  getPos(track) {
    const center = track.getPointAt(this.trackProgress);
    if (!this.lateralOffset || Math.abs(this.lateralOffset) < 0.001) {
      return center;
    }
    const normal = track.getNormalAt(this.trackProgress);
    return center.clone().add(normal.clone().multiplyScalar(this.lateralOffset));
  }

  /**
   * 是否为当前圈刷紫（最快圈）
   */
  isNewLapBest() {
    return this._isNewLapBest;
  }

  // ═══════════════════════════════════════════════════
  //  AI逻辑
  // ═══════════════════════════════════════════════════

  /**
   * AI驾驶逻辑
   * 弯道检测 → 自动减速 → 跟车修正 → DRS使用
   */
  _updateAI(dt, track, playerRef) {
    const t = this.trackProgress;

    // ─── 弯道检测 —— 通过切线变化率 ───
    const t1 = track.getTangentAt(t);
    const t2 = track.getTangentAt((t + 0.015) % 1);
    const turnRate = Math.abs(t1.x - t2.x) + Math.abs(t1.z - t2.z);

    // ─── 前方玩家检测（用于跟车） ───
    let gapToPlayer = Infinity;
    if (playerRef && !playerRef.dnf) {
      const rawGap = playerRef.trackProgress - t;
      gapToPlayer = rawGap > 0.5 ? rawGap - 1 : rawGap;
    }

    // ─── 弯道策略（弯中松油+点刹） ───
    if (turnRate > 0.12) {
      // 急弯
      this.aiThrottle = this._lerp(this.aiThrottle, 0.25 + this.skill * 0.35, dt * 4);
      this.aiBrake = this._lerp(this.aiBrake, 0.15 * (1 - this.skill), dt * 3);
    } else if (turnRate > 0.06) {
      // 中速弯
      this.aiThrottle = this._lerp(this.aiThrottle, 0.5 + this.skill * 0.3, dt * 3);
      this.aiBrake = this._lerp(this.aiBrake, 0.05 * (1 - this.skill), dt * 2);
    } else {
      // 直道全速
      this.aiThrottle = this._lerp(this.aiThrottle, 0.7 + this.skill * 0.25, dt * 3);
      this.aiBrake = this._lerp(this.aiBrake, 0, dt * 5);
    }

    // ─── 跟车减速（前车太近时） ───
    if (gapToPlayer < 0.04 && gapToPlayer > -0.02) {
      this.aiBrake = Math.max(this.aiBrake, 0.3);
      this.aiThrottle *= 0.4;
    }

    // ─── DRS使用（DRS区+距前车近） ───
    const inDRSZone = track.isDRSZone(t);
    const closeToTarget = gapToPlayer < 0.03 && gapToPlayer > -0.02;
    if (inDRSZone && closeToTarget && this.speed > 80) {
      this.drsOpen = true;
      this.drsOvertakes++;
    } else if (!inDRSZone) {
      this.drsOpen = false;
    }

    // ─── 转向 —— 基于赛道曲率的正弦波 + 技能随机 ───
    const trackSteer = Math.sin(t * Math.PI * 4 + this.driverName.charCodeAt(0)) * 0.15;
    this.aiSteer = trackSteer * (0.5 + this.skill * 0.5);

    // ─── AI横向修正（防止AI漂出赛道） ───
    this.aiSteer += -this.lateralOffset * 0.3;
    this.aiSteer = this._clamp(this.aiSteer, -0.5, 0.5);

    // ─── 出弯修正（防止偏离赛道） ───
    if (turnRate > 0.1 && this.speed > 100) {
      this.aiSteer *= 1.2;
    }

    // 接近护栏时AI主动减速（使用动态赛道宽度）
    const halfW = track && track.getHalfWidthAt ?
      track.getHalfWidthAt(t) - 0.3 : 1.85;
    if (Math.abs(this.lateralOffset) > halfW * 0.85) {
      this.aiThrottle *= 0.7;
    }
  }

  // ═══════════════════════════════════════════════════
  //  工具函数
  // ═══════════════════════════════════════════════════

  _lerp(a, b, t) {
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }

  _clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
}
