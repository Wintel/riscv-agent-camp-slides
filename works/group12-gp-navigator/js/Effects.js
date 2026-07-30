/**
 * ════════════════════════════════════════════════════════════════
 *  Effects.js — F1 特效系统
 *  功能：粒子系统、画面震动、动态模糊感、冲线特效、烟花彩带
 *  科普：
 *    画面震动 = 高速(>200km/h)时相机施加随机偏移，模拟G力感
 *    动态模糊 = 通过降低帧间清晰度 + 运动偏移实现视觉速度感
 * ════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';

export class Effects {
  constructor() {
    this.particles = [];       // 活跃粒子数组
    this.cameraShake = 0;      // 相机震动强度 (0~1)
    this._smokeCounter = 0;
    this._drsFxCounter = 0;
    this._confettiCounter = 0;
  }

  /**
   * 每帧更新所有粒子
   * @param {number} dt 帧时间差
   */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;

      if (p.userData.v) {
        // 物理粒子（有速度向量）
        p.position.add(p.userData.v.clone().multiplyScalar(dt));
        p.userData.life = (p.userData.life || 1) - dt * 1.2;
        if (p.userData.gravity) {
          p.userData.v.y -= 2.5 * dt;
        }
        if (p.userData.life <= 0 || p.position.y < -10) {
          this._removeParticle(i);
        }
      } else {
        // 装饰粒子（飘落/上升）
        const life = (p.userData.life || 1) - dt * 0.3;
        p.userData.life = life;
        if (p.userData.vy !== undefined) {
          p.position.y += p.userData.vy * dt;
        }
        if (p.userData.driftX !== undefined) {
          p.position.x += p.userData.driftX * dt;
          p.position.z += p.userData.driftZ * dt;
        }
        if (p.userData.rotSpeed !== undefined) {
          p.rotation.z += p.userData.rotSpeed * dt;
        }
        if (p.material && p.material.opacity !== undefined) {
          p.material.opacity = Math.max(0, life * 0.4);
        }
        if (life <= 0 || p.position.y < -20) {
          this._removeParticle(i);
        }
      }
    }
  }

  /**
   * 移除粒子并释放资源
   */
  _removeParticle(index, scene) {
    const p = this.particles[index];
    if (!p) return;
    if (scene) scene.remove(p);
    if (p.geometry) p.geometry.dispose();
    if (p.material) p.material.dispose();
    this.particles.splice(index, 1);
  }

  /**
   * 轮胎烟雾粒子（磨损>80%时产生）
   */
  addTireSmoke(scene, position, speed) {
    if (speed < 40) return;
    this._smokeCounter++;
    if (this._smokeCounter % 4 !== 0) return;

    for (let i = 0; i < 2; i++) {
      const sm = new THREE.Mesh(
        new THREE.SphereGeometry(0.04 + Math.random() * 0.06, 4, 4),
        new THREE.MeshBasicMaterial({
          color: 0xcccccc,
          transparent: true,
          opacity: 0.2 + Math.random() * 0.15,
        })
      );
      sm.position.copy(position);
      sm.position.x += (Math.random() - 0.5) * 1.2;
      sm.position.z += (Math.random() - 0.5) * 1.2;
      sm.position.y = 0.1;
      sm.userData.life = 0.8 + Math.random() * 0.6;
      sm.userData.vy = 0.15 + Math.random() * 0.25;
      sm.userData.driftX = (Math.random() - 0.5) * 0.1;
      sm.userData.driftZ = (Math.random() - 0.5) * 0.1;
      scene.add(sm);
      this.particles.push(sm);
    }
  }

  /**
   * DRS气流粒子（DRS激活时从尾翼后方流出）
   */
  addDRSParticles(scene, position, forward) {
    this._drsFxCounter++;
    if (this._drsFxCounter % 2 !== 0) return;

    for (let i = 0; i < 2; i++) {
      const dp = new THREE.Mesh(
        new THREE.SphereGeometry(0.025 + Math.random() * 0.025, 4, 4),
        new THREE.MeshBasicMaterial({
          color: 0x00aaff,
          transparent: true,
          opacity: 0.25 + Math.random() * 0.2,
        })
      );
      dp.position.copy(position);
      dp.position.x += (Math.random() - 0.5) * 1.0;
      dp.position.z += (Math.random() - 0.5) * 1.0;
      dp.position.y = 0.1 + Math.random() * 0.3;
      // 向后喷射
      dp.userData.v = forward.clone().multiplyScalar(-2 - Math.random() * 2);
      dp.userData.v.y = Math.random() * 0.3;
      dp.userData.life = 0.3 + Math.random() * 0.3;
      scene.add(dp);
      this.particles.push(dp);
    }
  }

  /**
   * 冲线特效 —— 彩色方块爆发
   */
  createFinishExplosion(scene, position) {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffd700, 0xff69b4, 0x00ffff, 0xffa500, 0x9933ff];
    for (let i = 0; i < 60; i++) {
      const size = 0.03 + Math.random() * 0.08;
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(size, size * 0.3, size * 1.5),
        new THREE.MeshStandardMaterial({
          color: colors[Math.floor(Math.random() * colors.length)],
          emissive: 0xffffff,
          emissiveIntensity: 0.1,
        })
      );
      p.position.copy(position);
      p.position.x += (Math.random() - 0.5) * 6;
      p.position.z += (Math.random() - 0.5) * 6;
      p.position.y = 1 + Math.random() * 2;
      p.userData.v = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 5,
        (Math.random() - 0.5) * 8
      );
      p.userData.life = 1.5 + Math.random() * 1;
      p.userData.gravity = true;
      scene.add(p);
      this.particles.push(p);
    }
  }

  /**
   * 颁奖典礼烟花
   */
  createFirework(scene, x, z) {
    const colors = [0xff0000, 0x00aa00, 0x0044ff, 0xffd700, 0xff69b4, 0x00ffff, 0xff6600];
    const color = colors[Math.floor(Math.random() * colors.length)];
    for (let i = 0; i < 25; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + Math.random() * 0.04, 4, 4),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.3,
        })
      );
      p.position.set(x, 3 + Math.random() * 6, z);
      const speed = 3 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      p.userData.v = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed + 2,
        Math.sin(phi) * Math.sin(theta) * speed
      );
      p.userData.life = 1.2 + Math.random() * 0.8;
      p.userData.gravity = true;
      scene.add(p);
      this.particles.push(p);
    }
  }

  /**
   * 颁奖彩带
   */
  createConfetti(scene) {
    this._confettiCounter++;
    if (this._confettiCounter % 4 !== 0) return;

    const conf = new THREE.Mesh(
      new THREE.BoxGeometry(0.02 + Math.random() * 0.04, 0.003, 0.06 + Math.random() * 0.1),
      new THREE.MeshBasicMaterial({
        color: [0xff0000, 0x00ff00, 0x0000ff, 0xffd700, 0xff69b4, 0x00ffff, 0xffa500][Math.floor(Math.random() * 7)],
      })
    );
    conf.position.set(
      (Math.random() - 0.5) * 60,
      14 + Math.random() * 8,
      -50 + (Math.random() - 0.5) * 30
    );
    conf.userData.vy = -0.3 - Math.random() * 0.6;
    conf.userData.driftX = (Math.random() - 0.5) * 1.5;
    conf.userData.driftZ = (Math.random() - 0.5) * 1.5;
    conf.userData.life = 4 + Math.random() * 3;
    conf.userData.rotSpeed = (Math.random() - 0.5) * 4;
    scene.add(conf);
    this.particles.push(conf);
  }

  /**
   * 获取相机震动偏移量
   * @returns {THREE.Vector3}
   */
  getShakeOffset() {
    if (this.cameraShake <= 0) return new THREE.Vector3();
    const intensity = this.cameraShake * 0.04;
    this.cameraShake *= 0.95; // 震动指数衰减
    return new THREE.Vector3(
      (Math.random() - 0.5) * intensity,
      (Math.random() - 0.5) * intensity,
      0
    );
  }

  /**
   * 触发高速震动
   * @param {number} speed 速度 km/h
   */
  triggerSpeedShake(speed) {
    if (speed > 200) {
      this.cameraShake = Math.min(1, (speed - 200) / 400);
    } else {
      this.cameraShake *= 0.95;
    }
  }

  /**
   * 清理所有粒子
   */
  clearAll(scene) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this._removeParticle(i, scene);
    }
  }
}
