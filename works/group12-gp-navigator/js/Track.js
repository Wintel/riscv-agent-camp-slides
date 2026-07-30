/**
 * ════════════════════════════════════════════════════════════════
 *  Track.js — F1 赛道生成系统
 *  功能：3D赛道生成、赛道物理查询、DRS区/维修区检测
 *  科普：
 *    CatmullRomCurve3 = 三次Catmull-Rom样条曲线
 *    通过控制点插值生成平滑闭环赛道路径
 *    赛道包括：沥青路面、草地、缓冲区、护栏、发车格、DRS标记
 * ════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';

export class Track {
  constructor() {
    this.curve = null;       // THREE.CatmullRomCurve3 — 赛道中心线
    this.meshGroup = null;   // 赛道全部3D对象的父Group
    this.controlPts = [];    // 原始控制点
    this.baseTrackWidth = 6; // 基础赛道宽度（适中）
    this.trackWidth = 6;     // 兼容旧引用
  }

  /**
   * 获取赛道某位置的弯道曲率（用于动态调整宽度）
   * 值越大说明弯越急
   */
  _getCurvatureAt(t) {
    const dt = 0.01;
    const t1 = this.curve.getTangentAt((((t - dt) % 1) + 1) % 1);
    const t2 = this.curve.getTangentAt(((t + dt) % 1 + 1) % 1);
    return Math.abs(t1.x - t2.x) + Math.abs(t1.z - t2.z);
  }

  /**
   * 获取赛道某位置的半宽度
   * 直道：baseTrackWidth/2 = 4.5
   * 中弯：×2 = 9
   * 急弯：×3 = 13.5
   */
  getHalfWidthAt(t) {
    const curve = this._getCurvatureAt(t);
    let mult = 1;
    if (curve > 0.10) mult = 2.2;       // 急弯2.2倍
    else if (curve > 0.05) mult = 1.5;  // 中弯1.5倍
    return (this.baseTrackWidth / 2) * mult;
  }

  /**
   * 生成赛道
   * 采用随机控制点 + Catmull-Rom插值
   * 返回: THREE.Group — 包含赛道地面、路缘、护栏、看台等全部元素
   */
  generate() {
    this.meshGroup = new THREE.Group();

    // ─── 生成赛道控制点（32点超级椭圆，直边+圆角弯道，不突出） ───
    const cpts = [];
    const nPts = 32;
    for (let i = 0; i < nPts; i++) {
      const a = (i / nPts) * Math.PI * 2;
      // 超级椭圆：exponent=0.55 → 顶底为直道，左右圆角弯道
      // 所有点严格在 ±46(x) × ±26(z) 框内，无任何突出
      const sigX = Math.sign(Math.cos(a)) || 1;
      const sigZ = Math.sign(Math.sin(a)) || 1;
      const x = sigX * 46 * Math.pow(Math.abs(Math.cos(a)), 0.55);
      const z = sigZ * 26 * Math.pow(Math.abs(Math.sin(a)), 0.55);
      cpts.push(new THREE.Vector3(x, 0, z));
    }
    this.controlPts = cpts;
    this.curve = new THREE.CatmullRomCurve3(cpts, true); // closed=true

    // ─── 大地（草地） ───
    const groundGeo = new THREE.PlaneGeometry(220, 220);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.95,
      metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.meshGroup.add(ground);

    // ─── 赛道沥青路面 ───
    const trackPoints = this.curve.getPoints(120);
    const trackShape = this._buildTrackMesh(trackPoints);
    this.meshGroup.add(trackShape);

    // ─── 赛道边缘白线 ───
    this._addTrackLines(trackPoints, this.trackWidth / 2, 0xffffff, 0.12);
    this._addTrackLines(trackPoints, -this.trackWidth / 2, 0xffffff, 0.12);

    // ─── 缓冲区（红白路肩） ───
    this._addCurb(trackPoints);

    // ─── 发车线（起始线：白+红方格） ───
    this._addStartLine();

    // ─── 维修区入口标记 ───
    this._addPitEntry();

    // ─── DRS检测区标记 ───
    this._addDRSMarkers();

    // ─── 赛道方向箭头（指引行车方向） ───
    this._addDirectionArrows(trackPoints);

    // ─── 看台（简易观众席模型） ───
    this._addGrandstands();

    // ─── 护栏 ───
    this._addBarriers(trackPoints);

    // ─── 领奖台 ───
    this._addPodium();

    // ─── 赛道照明灯柱 ───
    this._addLightPoles(trackPoints);

    // ─── 轮胎墙 ───
    this._addTireBarriers(trackPoints);

    return this.meshGroup;
  }

  /**
   * 构建赛道路面 Mesh
   */
  _buildTrackMesh(pts) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const N = pts.length;

    for (let i = 0; i <= N; i++) {
      const idx = i % N;
      const p = pts[idx];
      const t = idx / N;
      // 每段赛道使用动态宽度（弯道更宽）
      const hw = this.getHalfWidthAt(t);
      const tangent = this.curve.getTangentAt(t);
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();

      // 内侧点
      positions.push(p.x + normal.x * hw, 0.03, p.z + normal.z * hw);
      // 外侧点
      positions.push(p.x - normal.x * hw, 0.03, p.z - normal.z * hw);
      uvs.push(t, 0, t, 1);
    }

    for (let i = 0; i < N; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    // 赛道材质 — 深色沥青，轻微粗糙金属感
    const mat = new THREE.MeshStandardMaterial({
      color: 0x333344,
      roughness: 0.85,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * 添加赛道边缘线
   */
  _addTrackLines(pts, side, color, width) {
    const halfW = width / 2;
    const N = pts.length;
    const posArr = [];
    for (let i = 0; i <= N; i++) {
      const idx = i % N;
      const p = pts[idx];
      const t = idx / N;
      // 边缘线使用该段的动态半宽
      const hw = this.getHalfWidthAt(t);
      const sig = side > 0 ? 1 : -1;
      const tangent = this.curve.getTangentAt(t);
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      posArr.push(p.x + normal.x * hw * sig, 0.04, p.z + normal.z * hw * sig);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 });
    const line = new THREE.Line(lineGeo, lineMat);
    this.meshGroup.add(line);
  }

  /**
   * 添加红白路肩（缓冲区）
   */
  _addCurb(pts) {
    const N = pts.length;
    for (let i = 0; i < N; i += 3) {
      const idx = i % N;
      const p = pts[idx];
      const t = idx / N;
      const tangent = this.curve.getTangentAt(t);
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const color = i % 6 < 3 ? 0xff0000 : 0xffffff;
      const hw = this.getHalfWidthAt(t);
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.05, 0.15),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
      );
      curb.position.set(
        p.x + normal.x * (hw + 0.3),
        0.04,
        p.z + normal.z * (hw + 0.3)
      );
      curb.rotation.y = Math.atan2(-tangent.x, -tangent.z);
      this.meshGroup.add(curb);
    }
  }

  /**
   * 发车线（起始/终点线）
   */
  _addStartLine() {
    const sp = this.curve.getPointAt(0);
    const st = this.curve.getTangentAt(0);
    const sn = new THREE.Vector3(st.z, 0, -st.x).normalize();
    for (let j = -5; j <= 5; j++) {
      const p = sp.clone().add(sn.clone().multiplyScalar(j * 0.35));
      const sq = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 0.7),
        new THREE.MeshBasicMaterial({
          color: j % 2 === 0 ? 0xffffff : 0xcc0000,
          side: THREE.DoubleSide,
        })
      );
      sq.position.set(p.x, 0.07, p.z);
      sq.lookAt(p.x + st.x, 0, p.z + st.z);
      this.meshGroup.add(sq);
    }
  }

  /**
   * 维修区入口标记（使用赛道法线方向偏移，避免建筑横在赛道上）
   */
  _addPitEntry() {
    const pe = this.curve.getPointAt(0.85);
    const pitTangent = this.curve.getTangentAt(0.85);
    const pitNormal = new THREE.Vector3(pitTangent.z, 0, -pitTangent.x).normalize();
    // 沿法线方向（赛道外侧）偏移 8 单位
    const offsetX = pitNormal.x * 8;
    const offsetZ = pitNormal.z * 8;
    // 维修区建筑
    const pitBuild = new THREE.Mesh(
      new THREE.BoxGeometry(8, 2.5, 3),
      new THREE.MeshStandardMaterial({ color: 0x444466, roughness: 0.7, metalness: 0.3 })
    );
    pitBuild.position.set(pe.x + offsetX, 1.25, pe.z + offsetZ);
    pitBuild.lookAt(pe.x, 0, pe.z);
    this.meshGroup.add(pitBuild);

    // 维修区通道标记
    const pitSign = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 1),
      new THREE.MeshBasicMaterial({
        color: 0x0066ff,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      })
    );
    pitSign.position.set(pe.x + offsetX * 0.5, 3, pe.z + offsetZ * 0.5);
    pitSign.lookAt(pe.x, 0, pe.z);
    this.meshGroup.add(pitSign);
  }

  /**
   * DRS检测区标记
   */
  _addDRSMarkers() {
    // DRS入口标记（赛道8%位置）
    const dEntry = this.curve.getPointAt(0.08);
    const dTangent = this.curve.getTangentAt(0.08);
    const dNormal = new THREE.Vector3(dTangent.z, 0, -dTangent.x).normalize();
    const hw08 = this.getHalfWidthAt(0.08);
    const dSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 2),
      new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      })
    );
    dSign.position.set(dEntry.x + dNormal.x * (hw08 + 0.5), 0.5, dEntry.z + dNormal.z * (hw08 + 0.5));
    dSign.lookAt(dEntry.x, 0, dEntry.z);
    this.meshGroup.add(dSign);

    // DRS出口标记（赛道35%位置）
    const dExit = this.curve.getPointAt(0.35);
    const dExitTangent = this.curve.getTangentAt(0.35);
    const dExitNormal = new THREE.Vector3(dExitTangent.z, 0, -dExitTangent.x).normalize();
    const hw35 = this.getHalfWidthAt(0.35);
    const dSign2 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 2),
      new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      })
    );
    dSign2.position.set(dExit.x + dExitNormal.x * (hw35 + 0.5), 0.5, dExit.z + dExitNormal.z * (hw35 + 0.5));
    dSign2.lookAt(dExit.x, 0, dExit.z);
    this.meshGroup.add(dSign2);
  }

  /**
   * 赛道方向箭头（沿赛道中心线放置，指引行驶方向）
   */
  _addDirectionArrows(pts) {
    const N = pts.length;
    const step = Math.max(1, Math.floor(N / 14)); // 约14个箭头
    for (let i = 0; i < N; i += step) {
      const p = pts[i];
      const t = i / N;
      const tangent = this.curve.getTangentAt(t);
      // 箭头：一个三角形扁平片，指向切线方向
      const arrowShape = new THREE.Shape();
      arrowShape.moveTo(0, 0.3);
      arrowShape.lineTo(-0.15, -0.15);
      arrowShape.lineTo(0.15, -0.15);
      arrowShape.closePath();
      const arrowGeo = new THREE.ShapeGeometry(arrowShape);
      const arrowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.position.set(p.x, 0.05, p.z);
      // 箭头指向切线方向
      const angle = Math.atan2(tangent.x, tangent.z);
      arrow.rotation.y = -angle;
      arrow.rotation.x = -Math.PI / 2;
      this.meshGroup.add(arrow);
    }
  }

  /**
   * 看台（简易）
   */
  _addGrandstands() {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
      const r = 55 + Math.random() * 15;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const stand = new THREE.Mesh(
        new THREE.BoxGeometry(8, 1.2 + Math.random() * 0.5, 4),
        new THREE.MeshStandardMaterial({
          color: 0x556677,
          roughness: 0.8,
          metalness: 0.1,
        })
      );
      stand.position.set(x, 0.6, z);
      stand.lookAt(0, 0, 0);
      this.meshGroup.add(stand);

      // 顶棚
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(9, 0.08, 5),
        new THREE.MeshStandardMaterial({ color: 0x7788aa, roughness: 0.5, metalness: 0.3 })
      );
      roof.position.set(x, 1.5, z);
      roof.lookAt(0, 0, 0);
      this.meshGroup.add(roof);
    }
  }

  /**
   * 护栏
   */
  _addBarriers(pts) {
    const N = pts.length;
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x888899,
      roughness: 0.6,
      metalness: 0.4,
    });
    for (let i = 0; i < N; i += 2) {
      const idx = i % N;
      const p = pts[idx];
      const t = idx / N;
      const tangent = this.curve.getTangentAt(t);
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const hw = this.getHalfWidthAt(t);
      // 外侧护栏（跟随动态赛道宽度）
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.8), barrierMat);
      b1.position.set(
        p.x + normal.x * (hw + 1.0),
        0.25,
        p.z + normal.z * (hw + 1.0)
      );
      b1.rotation.y = Math.atan2(-tangent.x, -tangent.z);
      this.meshGroup.add(b1);
    }
  }

  /**
   * 轮胎墙（弯道外侧）
   */
  _addTireBarriers(pts) {
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const N = pts.length;
    for (let i = 0; i < N; i += 4) {
      const idx = i % N;
      const p = pts[idx];
      const t = idx / N;
      // 只在弯道区域放置
      const t1 = this.curve.getTangentAt(t);
      const t2 = this.curve.getTangentAt((t + 0.01) % 1);
      const turnRate = Math.abs(t1.x - t2.x) + Math.abs(t1.z - t2.z);
      if (turnRate < 0.1) continue;

      const normal = new THREE.Vector3(t1.z, 0, -t1.x).normalize();
      const hw = this.getHalfWidthAt(t);
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.06, 6, 10),
        tireMat
      );
      tire.position.set(
        p.x + normal.x * (hw + 1.5),
        0.12,
        p.z + normal.z * (hw + 1.5)
      );
      tire.rotation.x = Math.PI / 2;
      this.meshGroup.add(tire);
    }
  }

  /**
   * 领奖台（使用赛道法线方向偏移，保证位于赛道外侧）
   */
  _addPodium() {
    const pp = this.curve.getPointAt(0.02);
    const podiumTangent = this.curve.getTangentAt(0.02);
    const podiumNormal = new THREE.Vector3(podiumTangent.z, 0, -podiumTangent.x).normalize();
    const podiumAlong = new THREE.Vector3(-podiumTangent.x, 0, -podiumTangent.z).normalize();
    const podiumPositions = [
      { along: 0,   h: 1.2, color: 0xffd700 },
      { along: -2.5, h: 0.7, color: 0xc0c0c0 },
      { along: 2.5, h: 0.4, color: 0xcd7f32 },
    ];
    podiumPositions.forEach((p) => {
      const podium = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, p.h, 1.8),
        new THREE.MeshStandardMaterial({
          color: p.color,
          roughness: 0.3,
          metalness: 0.6,
        })
      );
      // 沿法线（赛道外侧）7 单位 + 沿赛道方向排列三个台阶
      podium.position.set(
        pp.x + podiumNormal.x * 7 + podiumAlong.x * p.along,
        p.h / 2,
        pp.z + podiumNormal.z * 7 + podiumAlong.z * p.along
      );
      this.meshGroup.add(podium);
    });
  }

  /**
   * 灯柱
   */
  _addLightPoles(pts) {
    const N = pts.length;
    for (let i = 0; i < N; i += Math.floor(N / 8)) {
      const p = pts[i];
      const t = i / N;
      const tangent = this.curve.getTangentAt(t);
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const hw = this.getHalfWidthAt(t);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.08, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 })
      );
      pole.position.set(
        p.x + normal.x * (hw + 1.8),
        3,
        p.z + normal.z * (hw + 1.8)
      );
      this.meshGroup.add(pole);
      // 灯头
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 6, 6),
        new THREE.MeshStandardMaterial({
          color: 0xffffcc,
          emissive: 0xffffaa,
          emissiveIntensity: 0.2,
        })
      );
      light.position.set(
        p.x + normal.x * (hw + 1.8),
        6.2,
        p.z + normal.z * (hw + 1.8)
      );
      this.meshGroup.add(light);
    }
  }

  // ═══════════════════════════════════════════════════
  //  赛道物理查询接口
  // ═══════════════════════════════════════════════════

  /**
   * 获取赛道上的障碍物列表（用于碰撞检测，防止赛车穿模）
   * 返回: [{ x, z, radius }] 障碍物中心坐标+碰撞半径
   */
  getObstacles() {
    if (this._obstacleCache) return this._obstacleCache;
    const obs = [];

    // 领奖台位置（t=0.02 处，法线方向偏移 7 单位）
    const pp = this.curve.getPointAt(0.02);
    const pTan = this.curve.getTangentAt(0.02);
    const pNorm = new THREE.Vector3(pTan.z, 0, -pTan.x).normalize();
    const pAlong = new THREE.Vector3(-pTan.x, 0, -pTan.z).normalize();
    const ppX = pp.x + pNorm.x * 7;
    const ppZ = pp.z + pNorm.z * 7;
    // 三个台阶（宽 1.8，间距 2.5）
    [-2.5, 0, 2.5].forEach((al) => {
      obs.push({
        x: ppX + pAlong.x * al,
        z: ppZ + pAlong.z * al,
        radius: 1.5,
      });
    });

    // 维修区建筑（t=0.85 处，法线方向偏移 8 单位）
    const pitT = 0.85;
    const pe = this.curve.getPointAt(pitT);
    const pitTan = this.curve.getTangentAt(pitT);
    const pitNorm = new THREE.Vector3(pitTan.z, 0, -pitTan.x).normalize();
    obs.push({
      x: pe.x + pitNorm.x * 8,
      z: pe.z + pitNorm.z * 8,
      radius: 4.5,  // 建筑尺寸 8x3
    });

    this._obstacleCache = obs;
    return obs;
  }

  /**
   * 检测赛车是否与障碍物碰撞
   * @param {number} x 赛车世界x
   * @param {number} z 赛车世界z
   * @returns {boolean} 是否碰撞
   */
  checkObstacleCollision(x, z) {
    const obs = this.getObstacles();
    for (let i = 0; i < obs.length; i++) {
      const dx = x - obs[i].x;
      const dz = z - obs[i].z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < obs[i].radius) return true;
    }
    return false;
  }

  /**
   * 获取赛道上某位置的世界坐标
   * @param {number} t  赛道进度 0~1（闭环自纠正）
   * @returns {THREE.Vector3}
   */
  getPointAt(t) {
    if (!this.curve) return new THREE.Vector3();
    const nt = (((t % 1) + 1) % 1);
    return this.curve.getPointAt(nt);
  }

  /**
   * 获取赛道上某位置的切线方向
   */
  getTangentAt(t) {
    if (!this.curve) return new THREE.Vector3(1, 0, 0);
    const nt = (((t % 1) + 1) % 1);
    return this.curve.getTangentAt(nt);
  }

  /**
   * 获取赛道上某位置的法线方向（水平）
   */
  getNormalAt(t) {
    if (!this.curve) return new THREE.Vector3(0, 0, 1);
    const tangent = this.getTangentAt(t);
    return new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
  }

  /**
   * DRS检测区判定
   * 赛道 8% ~ 35% 范围为DRS区
   */
  isDRSZone(t) {
    const p = (((t % 1) + 1) % 1);
    return p > 0.08 && p < 0.35;
  }

  /**
   * 维修区判定
   * @param {THREE.Vector3} pos 世界坐标
   */
  isPitLane(pos) {
    return pos.x < 14 && pos.x > -24 && pos.z > 5 && pos.z < 16;
  }

  /**
   * 圈判定：赛车是否经过了发车线
   * 当进度从 >0.7 跳变到 <0.3 时算一圈
   */
  lapPassed(t1, t2) {
    return Math.abs(t1 - t2) > 0.4 && t1 > 0.7 && t2 < 0.3;
  }
}
