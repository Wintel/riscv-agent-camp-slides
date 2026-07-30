/**
 * ════════════════════════════════════════════════════════════════
 *  main.js — F1 方程式竞速 主引擎
 *
 *  代码分层架构：
 *    main.js    → 游戏状态机、场景初始化、主循环、相机系统
 *    Input.js   → 键盘 + 触屏输入
 *    Track.js   → 赛道生成与物理查询
 *    Car.js     → 赛车物理、DRS、轮胎、进站、AI
 *    UI.js      → HUD、菜单、动画UI
 *    Effects.js → 粒子、震动、特效
 *
 *  三大核心模块（由状态机state控制）：
 *    ① opener   → 赛前电影级开场动画（8秒5阶段运镜）
 *    ② racing   → 多视角自由竞速对局
 *    ③ ceremony → 冲线颁奖典礼
 *
 *  F1专业系统名词通俗科普（代码内注释同步）：
 *    详见 Car.js 头部注释
 * ════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import { Track } from './Track.js';
import { F1Car } from './Car.js';
import { F1Input } from './Input.js';
import { UI } from './UI.js';
import { Effects } from './Effects.js';

/**
 * F1Game — 游戏主类
 * 负责状态管理、Three.js初始化、主循环、相机系统、比赛逻辑
 */
export class F1Game {
  constructor() {
    // ═══ 游戏状态 ═══
    this.state = 'init';       // init|paused|opener|racing|finished|ceremony
    this.racePhase = 'pre';    // pre|racing
    this.raceStarted = false;
    this.totalLaps = 5;
    this.position = 1;
    this.totalCars = 6;
    this.gameSpeed = 1;

    // 计时
    this.raceTime = 0;
    this.drsAvailable = false;
    this.drsActive = false;

    // 开场/典礼计时（用于动画缓动）
    this._openerT = 0;
    this._ceremonyT = 0;
    this._countDone = false;
    this._podiumMoved = false;

    // 缓存性能相关
    this._lastTime = performance.now();
    this._frameCount = 0;

    // ═══ 子系统 ═══
    this.input = new F1Input();
    this.ui = new UI();
    this.effects = new Effects();

    // Three.js 对象
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // 赛道和赛车
    this.track = null;
    this.playerCar = null;
    this.aiCars = [];
    this._results = null;

    // 相机模式: 0座舱 1车头 2第三人称 3高空上帝 4动态电影
    this.camMode = 2;

    // 开场动画阶段
    this._openerStage = 0;

    // 初始化
    this._init();
  }

  /* ═══════════════════════════════════════════════════════════
   *  初始化
   * ═══════════════════════════════════════════════════════════ */

  _init() {
    try {
      // ─── Three.js 场景 ───
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x4a7a9a);
      this.scene.fog = new THREE.Fog(0x4a7a9a, 80, 180);

      // ─── 渲染器 (PBR + 动态阴影) ───
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      // r160 使用 colorSpace 替代 outputEncoding
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      document.body.appendChild(this.renderer.domElement);

      // ─── 相机 ───
      this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 300);

      // ─── 灯光系统 ───
      this._setupLights();

      // ─── 赛道 ───
      this.track = new Track();
      this.scene.add(this.track.generate());

      // ─── 赛车 ───
      this._createCars();

      // ─── 窗口缩放 ───
      window.addEventListener('resize', () => this._onResize());

      // ─── 进入暂停（轮胎选择） ───
      this.state = 'paused';
      this.camera.position.set(0, 18, 6);
      this.camera.lookAt(0, 0, -2);

      // ─── 显示轮胎选择弹窗 ───
      this.ui.showTireModal();

      // ─── 启动主循环 ───
      this._lastTime = performance.now();
      this._loop();

      // 自动发车超时（15秒无人操作）
      setTimeout(() => {
        if (this.state === 'paused') this._confirmedStart();
      }, 15000);

    } catch (e) {
      console.error('F1Game init error:', e);
      // 降级启动
      setTimeout(() => this._confirmedStart(), 1000);
    }
  }

  /**
   * 灯光系统
   * 主光源方向光 + 环境补光 + 半球光 = 模拟真实赛道光照
   */
  _setupLights() {
    // 环境光
    this.scene.add(new THREE.AmbientLight(0x88aacc, 0.55));

    // 主光源（太阳）
    const sun = new THREE.DirectionalLight(0xfff0e0, 1.5);
    sun.position.set(50, 70, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 150;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    this.scene.add(sun);

    // 补充冷光
    const fill = new THREE.DirectionalLight(0x4488ff, 0.3);
    fill.position.set(-30, 40, -20);
    this.scene.add(fill);

    // 半球光（天空/地面）
    this.scene.add(new THREE.HemisphereLight(0x88ccff, 0x4a8a4a, 0.55));
  }

  /**
   * 创建所有赛车（1玩家 + 5 AI）
   * 按发车排位坐标摆放
   */
  _createCars() {
    const sp = this.track.getPointAt(0);
    const st = this.track.getTangentAt(0);
    const fwd = new THREE.Vector3(-st.x, 0, -st.z).normalize();
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);

    // 发车格坐标（2列，3行）
    const grid = [];
    for (let i = 0; i < 6; i++) {
      const row = Math.floor(i / 2);
      const side = (i % 2 === 0) ? 1 : -1;
      grid.push({
        x: sp.x + fwd.x * (-row * 6) + right.x * side * 1.5,
        z: sp.z + fwd.z * (-row * 6) + right.z * side * 1.5,
      });
    }

    const face = Math.atan2(fwd.x, fwd.z);

    // 玩家赛车
    this.playerCar = new F1Car({
      isPlayer: true,
      color: 0xe03030,
      driverName: 'YOU',
      skill: 1,
      tire: 'medium',
    });
    this.playerCar.createModel(this.scene);
    this.playerCar.position.set(grid[0].x, 0, grid[0].z);
    this.playerCar.rotation.y = face;
    this.playerCar.model.position.set(grid[0].x, 0, grid[0].z);
    this.playerCar.model.rotation.y = face;

    // AI赛车（5名）
    const aiNames = ['VER', 'HAM', 'LEC', 'PER', 'SAI'];
    const aiColors = [0x3060e0, 0x00aa44, 0xe03030, 0x3040cc, 0xcc0044];
    this.aiCars = [];
    for (let j = 0; j < 5; j++) {
      const ac = new F1Car({
        isPlayer: false,
        color: aiColors[j],
        driverName: aiNames[j],
        skill: 0.55 + Math.random() * 0.35,
        tire: ['soft', 'medium', 'hard'][Math.floor(Math.random() * 3)],
      });
      ac.createModel(this.scene);
      ac.position.set(grid[j + 1].x, 0, grid[j + 1].z);
      ac.rotation.y = face;
      ac.model.position.set(grid[j + 1].x, 0, grid[j + 1].z);
      ac.model.rotation.y = face;
      this.aiCars.push(ac);
    }
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ═══════════════════════════════════════════════════════════
   *  全局函数 — 供HTML按钮回调
   * ═══════════════════════════════════════════════════════════ */

  /** 重启比赛 */
  restartRace() {
    location.reload();
  }

  /** 退出到首页 */
  exitToMenu() {
    window.location.href = './guide/index.html';
  }

  /** 视角循环切换 */
  cycleCamera(dir = 1) {
    this.camMode = (((this.camMode + dir) % 5) + 5) % 5;
    const names = ['座舱视角', '车头前置', '第三人称', '高空上帝', '动态电影'];
    this.ui.toast('📷 ' + names[this.camMode]);
  }

  /* ═══════════════════════════════════════════════════════════
   *  状态切换函数
   * ═══════════════════════════════════════════════════════════ */

  /**
   * → 开场动画
   * 轮胎选择确认后调用
   */
  toOpener() {
    this.state = 'opener';
    this._openerT = 0;
    this._openerStage = 0;
    this._countDone = false;

    this.ui.showOpenerUI();
    this.ui.hideHUD();

    // 初始相机位置：高空俯瞰
    this.camera.position.set(0, 65, -20);
    this.camera.lookAt(0, 0, -30);

    this.ui.toast('🏁 赛前电影');
    this.ui.showTrackName(
      '上海国际赛车场',
      'Shanghai International Circuit · 5.451 km · 16 弯道'
    );
  }

  /**
   * → 3-2-1-GO 倒计时
   * 开场动画结束后自动调用
   */
  _startCountdown() {
    if (this._countDone) return;
    this._countDone = true;
    this.ui.hideOpenerUI();
    this.ui.hideDRSAnnotation();

    this.ui.runCountdown(() => {
      // GO! → 切换到竞速状态
      this.state = 'racing';
      this.racePhase = 'racing';
      this.raceStarted = true;
      this.gameSpeed = 1;

      this.ui.showHUD();
      this.input.autoThrottle = true;

      this.ui.toast('🏁 GO! GO! GO!');
    });
  }

  /* ═══════════════════════════════════════════════════════════
   *  主循环 — requestAnimationFrame
   * ═══════════════════════════════════════════════════════════ */

  _loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._lastTime) / 1000);
    this._lastTime = now;

    const gdt = dt * this.gameSpeed;

    try {
      // ─── 状态机分发 ───
      switch (this.state) {
        case 'paused':
          break;  // 等待轮胎选择

        case 'opener':
          this._updateOpener(dt);
          break;

        case 'racing':
          this._updateRacing(gdt);
          break;

        case 'finished':
          this._updateFinished(dt);
          break;

        case 'ceremony':
          this._updateCeremony(dt);
          break;
      }

      // ─── 粒子更新 ───
      this.effects.update(dt);

      // ─── 渲染 ───
      this.renderer.render(this.scene, this.camera);

    } catch (e) {
      console.error('Loop error:', e);
    }

    this._frameCount++;
    requestAnimationFrame(() => this._loop());
  }

  /* ═══════════════════════════════════════════════════════════
   *  ① 开场动画更新
   *  时间轴：0-2s高空 → 2-4s俯冲弯道 → 4-5.5s DRS直道 →
   *         5.5-6.5s看台细节 → 6.5-8s锁定发车格 → 倒计时
   * ═══════════════════════════════════════════════════════════ */

  _updateOpener(dt) {
    this._openerT += dt;
    const t = this._openerT;

    // 获取赛道起点坐标
    const sp = this.track.getPointAt(0);
    const lookTarget = new THREE.Vector3(sp.x, 0, sp.z);

    if (t < 2.0) {
      // ① 高空俯瞰（0-2s）：从高空缓缓下降
      const p = t / 2;
      this.camera.position.lerp(
        new THREE.Vector3(sp.x + 5, 65 - p * 25, sp.z - 20 + p * 3),
        0.06
      );
      this.camera.lookAt(sp.x, 0, sp.z - 10);
      this._openerStage = 1;

    } else if (t < 4.0) {
      // ② 俯冲弯道特写（2-4s）：跟随赛道第5%~40%段
      this._openerStage = 2;
      const p = (t - 2) / 2;
      const targetT = 0.05 + p * 0.35;
      const target = this.track.getPointAt(targetT);
      const targetTangent = this.track.getTangentAt(targetT);
      this.camera.position.lerp(
        new THREE.Vector3(target.x + 10 - p * 4, 8 - p * 4, target.z + 8 - p * 2),
        0.06
      );
      this.camera.lookAt(target);

    } else if (t < 5.5) {
      // ③ DRS长直道（4-5.5s）：平移到直道方向
      this._openerStage = 3;
      const targetT = 0.22;
      const target = this.track.getPointAt(targetT);
      const tangent = this.track.getTangentAt(targetT);
      this.camera.position.lerp(
        new THREE.Vector3(target.x - tangent.x * 2, 3.5, target.z - tangent.z * 2 + 10),
        0.05
      );
      this.camera.lookAt(target.x - tangent.x * 6, 0, target.z - tangent.z * 6);
      // 显示DRS标注
      this.ui.showDRSAnnotation();

    } else if (t < 6.5) {
      // ④ 看台/护栏细节（5.5-6.5s）
      this._openerStage = 4;
      this.ui.hideDRSAnnotation();
      this.camera.position.lerp(
        new THREE.Vector3(sp.x + 6, 2.5, sp.z + 8),
        0.05
      );
      this.camera.lookAt(sp.x, 0, sp.z - 3);

    } else {
      // ⑤ 锁定发车格（6.5-8s）
      this._openerStage = 5;
      this.ui.hideDRSAnnotation();
      this.camera.position.lerp(
        new THREE.Vector3(0, 3.5, 10),
        0.04
      );
      this.camera.lookAt(0, 0, -2);

      // 到达8秒后自动开始倒计时
      if (t > 8.0) {
        this._startCountdown();
      }
    }

    // 开场期间所有赛车静止
    this.playerCar.speed = 0;
    this.playerCar.enginePower = 0;
    this.aiCars.forEach((ac) => { ac.speed = 0; ac.enginePower = 0; });
  }

  /* ═══════════════════════════════════════════════════════════
   *  ② 竞速循环更新
   * ═══════════════════════════════════════════════════════════ */

  _updateRacing(dt) {
    if (this.racePhase !== 'racing') return;

    // ─── 玩家赛车物理更新 ───
    if (this.playerCar) {
      this.playerCar.update(dt, this.track, this.input);

      // 高速震动
      this.effects.triggerSpeedShake(this.playerCar.speed);

      // 轮胎磨损 >80% 冒烟
      const avgWear = this.playerCar.tireWear.reduce((a, b) => a + b, 0) / 4;
      if (avgWear > 70 && this.playerCar.speed > 30) {
        this.effects.addTireSmoke(this.scene, this.playerCar.position, this.playerCar.speed);
      }

      // DRS激活时粒子
      this.checkDRS();
      if (this.drsActive) {
        const fwd = new THREE.Vector3(
          -Math.sin(this.playerCar.rotation.y),
          0,
          Math.cos(this.playerCar.rotation.y)
        );
        this.effects.addDRSParticles(this.scene, this.playerCar.position, fwd);
      }
    }

    // ─── AI赛车物理更新 ───
    this.aiCars.forEach((ac) => {
      if (!ac.dnf) {
        ac.update(dt, this.track, null, this.playerCar);
      }
    });

    // ─── 更新排名 ───
    this._updatePositions();

    // ─── 视角切换（C/V键） ───
    const camDir = this.input.camChangeRequested;
    if (camDir !== 0) this.cycleCamera(camDir);

    // ─── 冲线检测 ───
    this._checkFinish();

    // ─── 相机更新 ───
    this._updateCamera();

    // ─── HUD更新 ───
    this.ui.updateHUD(this);
  }

  /**
   * DRS检测
   * 条件：DRS区 + 距前车≤1.5s + 非维修区 + 速度>80km/h
   */
  checkDRS() {
    const car = this.playerCar;
    if (!car || !this.raceStarted) {
      this.drsAvailable = false;
      return;
    }

    const t = car.trackProgress;
    const inDRSZone = this.track.isDRSZone(t);
    const inPit = this.track.isPitLane(car.position);

    // 计算与前车时间差
    let gap = Infinity;
    for (const ac of this.aiCars) {
      if (ac.dnf || ac.lapCount < car.lapCount) continue;
      let rawGap = ac.trackProgress - t;
      if (rawGap > 0.5) rawGap -= 1;
      if (rawGap < 0 && rawGap > -0.02) continue; // 前车在后面不算
      if (rawGap > 0 && rawGap < gap) gap = rawGap;
    }
    // 将赛道进度差转为时间差（估计值：1% ≈ 1.2秒）
    const timeGap = gap < 0.15 ? gap * 120 : Infinity;

    const drsHeld = this.input.consumeDRS();

    // DRS可用条件：在DRS区 + 按Space + 速度>80 + 不在维修区
    // 去掉timeGap限制，单人游戏也能自由开启
    this.drsAvailable = inDRSZone && car.speed > 80 && !inPit && !car.pitting;

    // DRS激活控制：进入DRS区后按住Space激活，松键或出区关闭
    if (this.drsAvailable && drsHeld) {
      this.drsActive = true;
      car.drsOpen = true;
    } else {
      this.drsActive = false;
      car.drsOpen = false;
    }
  }

  /**
   * 排序：按圈数降序→进度降序
   */
  _updatePositions() {
    const all = [this.playerCar, ...this.aiCars];
    all.sort((a, b) => {
      if (a.lapCount !== b.lapCount) return b.lapCount - a.lapCount;
      return b.trackProgress - a.trackProgress;
    });
    this.position = all.indexOf(this.playerCar) + 1;
  }

  /**
   * 冲线检测：完成5圈即冲线
   */
  _checkFinish() {
    if (this.racePhase !== 'racing') return;
    if (this.playerCar && this.playerCar.lapCount >= this.totalLaps) {
      this._finish();
    }
  }

  /**
   * 冲线处理
   */
  _finish() {
    this.racePhase = 'finished';
    this.gameSpeed = 0.6;  // 慢动作

    // 生成排名结果
    const all = [this.playerCar, ...this.aiCars];
    all.sort((a, b) => {
      if (a.lapCount !== b.lapCount) return b.lapCount - a.lapCount;
      return b.trackProgress - a.trackProgress;
    });

    this._results = all.map((c, i) => ({
      pos: i + 1,
      name: c.driverName,
      isPlayer: c.isPlayer,
      time: this._fmtTime(c.raceTime + c.penaltyTime),
      bestLap: c.bestLap === Infinity ? '--' : this._fmtTime(c.bestLap),
      pits: c.pitStops,
      drsOvertakes: c.drsOvertakes,
      dnf: c.dnf,
    }));

    // 冲线特效
    this.effects.createFinishExplosion(this.scene, this.playerCar.position);

    this.ui.toast('🏁 冲线！比赛结束');
    this.state = 'finished';
    this._finishedTimer = 0;

    // 3秒后切入颁奖典礼
    setTimeout(() => {
      this._toCeremony();
    }, 3000);
  }

  _updateFinished(dt) {
    // 慢动作冲线阶段：继续更新赛车但减速
    const gdt = dt * this.gameSpeed;
    if (this.playerCar) {
      this.playerCar.update(gdt, this.track, this.input);
      this.playerCar.speed *= 0.97; // 逐渐减速
    }
    this.aiCars.forEach((ac) => {
      if (!ac.dnf) ac.update(gdt, this.track, null, this.playerCar);
    });
    // 冲线阶段使用第三人称固定视角
    this.camMode = 2;
    this._updateCamera();
  }

  /* ═══════════════════════════════════════════════════════════
   *  ③ 颁奖典礼
   * ═══════════════════════════════════════════════════════════ */

  _toCeremony() {
    this.state = 'ceremony';
    this._ceremonyT = 0;
    this.gameSpeed = 1;
    this._podiumMoved = false;

    this.ui.hideHUD();
    this.ui.showCeremony();

    // 填充结果表格
    this.ui.populateResults(this._results);

    // 移动赛车到领奖台
    this._moveCarsToPodium();

    // 1秒后添加灯光/烟花
    setTimeout(() => {
      this._ceremonyT = 1;
      this._podiumMoved = true;

      // 3束聚光灯
      this._createPodiumLights();

      // 烟花循环
      this._fireworksInterval = setInterval(() => {
        if (this.state !== 'ceremony') {
          clearInterval(this._fireworksInterval);
          return;
        }
        this.effects.createFirework(
          this.scene,
          (Math.random() - 0.5) * 55,
          -50 + (Math.random() - 0.5) * 25
        );
      }, 400);
    }, 1200);
  }

  /**
   * 赛车移动到领奖台位置
   */
  _moveCarsToPodium() {
    if (!this._results) return;
    const podiumPos = [
      { x: 0, z: -52 },
      { x: -6, z: -48 },
      { x: 6, z: -46 },
    ];

    const all = [this.playerCar, ...this.aiCars];
    podiumPos.forEach((pos, i) => {
      if (i >= this._results.length) return;
      const r = this._results[i];
      let car = null;
      for (const c of all) {
        if (c.driverName === r.name) { car = c; break; }
      }
      if (!car) return;

      const startPos = car.position.clone();
      const endPos = new THREE.Vector3(pos.x, 0, pos.z);
      let elapsed = 0;

      const anim = () => {
        elapsed += 0.016;
        const p = Math.min(1, elapsed / 1.5);
        // ease-out cubic
        const ep = 1 - Math.pow(1 - p, 3);
        car.position.lerpVectors(startPos, endPos, ep);
        if (car.model) {
          car.model.position.copy(car.position);
          car.model.rotation.y = Math.PI;
        }
        if (p < 1 && this.state === 'ceremony') {
          requestAnimationFrame(anim);
        }
      };
      anim();
    });
  }

  /**
   * 3束聚光灯（金/银/铜）
   */
  _createPodiumLights() {
    const colors = [0xffd700, 0xc0c0c0, 0xcd7f32];
    [-6, 0, 6].forEach((x, i) => {
      const spot = new THREE.SpotLight(colors[i] || 0xffffff, 1.5);
      spot.position.set(x, 16, -50);
      spot.target.position.set(x, 0, -50);
      spot.angle = 0.15;
      spot.penumbra = 0.4;
      spot.decay = 1;
      spot.distance = 60;
      this.scene.add(spot);
      this.scene.add(spot.target);
      // 存到粒子数组以便更新强度闪烁
      this.effects.particles.push(spot);
    });
  }

  /**
   * 颁奖典礼循环
   */
  _updateCeremony(dt) {
    this._ceremonyT += dt * 0.05;

    // 聚光灯闪烁效果
    this.effects.particles.forEach((p) => {
      if (p instanceof THREE.SpotLight) {
        p.intensity = 0.8 + Math.sin(this._ceremonyT * 12 + p.position.x) * 0.5;
      }
    });

    // 彩带飘落
    this.effects.createConfetti(this.scene);

    // 相机缓慢推进
    if (this._podiumMoved) {
      this.camera.position.lerp(
        new THREE.Vector3(
          0 + Math.sin(this._ceremonyT * 0.08) * 2,
          5 + this._ceremonyT * 0.3,
          -30 - this._ceremonyT * 0.5
        ),
        0.015
      );
      this.camera.lookAt(0, 1, -50);
    }
  }

  /* ═══════════════════════════════════════════════════════════
   *  相机系统 — 5种视角
   * ═══════════════════════════════════════════════════════════ */

  _updateCamera() {
    const car = this.playerCar;
    if (!car || !car.model) return;

    const p = car.position;
    const ry = car.rotation.y;
    const s = car.speed;
    const target = new THREE.Vector3();

    switch (this.camMode) {
      case 0: // 座舱第一人称
        target.set(
          p.x - Math.sin(ry) * 15,
          p.y + 0.3,
          p.z + Math.cos(ry) * 15
        );
        this.camera.position.lerp(
          new THREE.Vector3(p.x - Math.sin(ry) * 0.2, p.y + 0.55, p.z + Math.cos(ry) * 0.2),
          0.12
        );
        this.camera.fov = 70;
        this.camera.lookAt(target);
        break;

      case 1: // 车头前置
        this.camera.position.lerp(
          new THREE.Vector3(p.x + Math.sin(ry) * 1.8, p.y + 0.5, p.z - Math.cos(ry) * 1.8),
          0.1
        );
        this.camera.fov = 65;
        this.camera.lookAt(
          p.x - Math.sin(ry) * 15,
          p.y + 0.2,
          p.z + Math.cos(ry) * 15
        );
        break;

      case 2: // 第三人称尾随（默认）
        const d2 = 5 + s / 70;
        const h2 = 2.5 + s / 130;
        this.camera.position.lerp(
          new THREE.Vector3(
            p.x - Math.sin(ry) * d2,
            p.y + h2,
            p.z + Math.cos(ry) * d2
          ),
          0.08
        );
        this.camera.fov = 60;
        this.camera.lookAt(p.x, p.y + 0.3, p.z);
        break;

      case 3: // 高空上帝视角
        this.camera.position.lerp(
          new THREE.Vector3(0, 60, -60),
          0.03
        );
        this.camera.fov = 40;
        this.camera.lookAt(0, 0, -50);
        break;

      case 4: // 动态电影视角
        const a = this.raceTime * 0.3;
        const r = 14 + s / 55;
        this.camera.position.lerp(
          new THREE.Vector3(
            p.x + Math.cos(a) * r,
            p.y + 3.5 + Math.sin(this.raceTime * 0.5) * 1.5,
            p.z + Math.sin(a) * r
          ),
          0.06
        );
        this.camera.fov = 55;
        this.camera.lookAt(p.x, p.y + 0.5, p.z);
        break;
    }

    // 高速度震动（>200km/h时触发）
    if (s > 200 && this.camMode !== 3) {
      const shakeIntensity = Math.min(0.04, (s - 200) / 4000);
      this.camera.position.x += (Math.random() - 0.5) * shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * shakeIntensity * 0.5;
    }

    // 相机更新投影
    this.camera.updateProjectionMatrix();
  }

  /* ═══════════════════════════════════════════════════════════
   *  工具函数
   * ═══════════════════════════════════════════════════════════ */

  _fmtTime(s) {
    if (typeof s !== 'number' || !isFinite(s) || s < 0) return '--:--.---';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return String(m).padStart(2, '0') + ':' +
           String(sec).padStart(2, '0') + '.' +
           String(ms).padStart(3, '0');
  }
}

/* ═══════════════════════════════════════════════════════════
 *  全局轮胎选择函数（由HTML按钮回调）
 * ═══════════════════════════════════════════════════════════ */

let _selectedTire = 'medium';

window.selectTire = function(tire) {
  _selectedTire = tire;
  document.querySelectorAll('.tire-opt').forEach((el) => el.classList.remove('selected'));
  const el = document.querySelector(`.tire-opt[data-tire="${tire}"]`);
  if (el) el.classList.add('selected');
  const btn = document.getElementById('tireConfirmBtn');
  if (btn) btn.disabled = false;
};

window.confirmTire = function() {
  const game = window.f1Game;
  if (!game) return;

  const tire = _selectedTire || 'medium';
  game.ui.hideTireModal();

  // 设置玩家轮胎
  if (game.playerCar) {
    game.playerCar.tireCompound = tire;
    game.playerCar.curTire = game.playerCar.tireConfigs[tire];
  }

  game.ui.toast('🏁 准备发车！ ' +
    ({ soft: '软胎', medium: '中性胎', hard: '硬胎' })[tire] +
    ' 已选择'
  );

  // 进入开场动画
  game.toOpener();
};
