/**
 * ════════════════════════════════════════════════════════════════
 *  UI.js — F1 用户界面系统
 *  功能：HUD实时数据更新、开场动画UI、轮胎选择弹窗、
 *        倒计时覆盖层、颁奖典礼UI、Toast消息
 *  科普：
 *    HUD = Heads-Up Display (抬头显示)
 *    所有数据通过DOM操作读取G对象，不依赖Three.js
 * ════════════════════════════════════════════════════════════════
 */

export class UI {
  constructor() {
    this._hudEl = document.getElementById('hud');
    this._openerEl = document.getElementById('openerUI');
    this._ceremonyEl = document.getElementById('ceremonyUI');
    this._countdownEl = document.getElementById('countdownOverlay');
    this._toastEl = document.getElementById('infoToast');
    this._modalEl = document.getElementById('tireSelectModal');

    // 缓存DOM引用
    this._speed = document.getElementById('speedDisplay');
    this._gear = document.getElementById('gearDisplay');
    this._lap = document.getElementById('currentLap');
    this._totalLaps = document.getElementById('totalLaps');
    this._pos = document.getElementById('racePosition');
    this._raceTimer = document.getElementById('raceTimer');
    this._lapTimer = document.getElementById('lapTimer');
    this._bestLap = document.getElementById('bestLapDisplay');
    this._fuel = document.getElementById('fuelDisplay');
    this._pitDist = document.getElementById('pitDistDisplay');
    this._penalty = document.getElementById('penaltyDisplay');
    this._drsActiveText = document.getElementById('drsActiveText');
    this._drsLight1 = document.getElementById('drsLight1');
    this._drsLight2 = document.getElementById('drsLight2');
    this._drsStatus = document.getElementById('drsStatus');
    this._drsIndicator = document.getElementById('drsIndicator');
    this._tireFills = [
      document.querySelector('#tireWidget .tire-FL .tire-fill'),
      document.querySelector('#tireWidget .tire-FR .tire-fill'),
      document.querySelector('#tireWidget .tire-RL .tire-fill'),
      document.querySelector('#tireWidget .tire-RR .tire-fill'),
    ];
    this._bestNotify = document.getElementById('bestLapNotify');
    this._trackName = document.getElementById('trackNameText');
    this._drsAnnotation = document.getElementById('drsAnnotation');
    this._countNum = document.getElementById('countdownNum');
    this._flashWhite = document.getElementById('flashWhite');
    this._resultsList = document.getElementById('resultsList');
    this._podiumTitle = document.getElementById('podiumTitle');
    this._resultsPanel = document.getElementById('resultsPanel');
    this._postBtns = document.getElementById('postRaceBtns');

    // 轮胎选择弹窗
    this._tireConfirmBtn = document.getElementById('tireConfirmBtn');

    if (this._totalLaps) this._totalLaps.textContent = '5';
  }

  /* ─── HUD更新（每帧被gameLoop调用） ─── */
  updateHUD(game) {
    if (game.state !== 'racing') return;
    const car = game.playerCar;
    if (!car) return;

    // 速度
    if (this._speed) {
      this._speed.innerHTML = Math.round(car.speed) + ' <span>km/h</span>';
    }

    // 档位
    if (this._gear) {
      const gear = car.speed < 5 ? 'N' : car.speed < 40 ? '1' : car.speed < 80 ? '2' :
        car.speed < 130 ? '3' : car.speed < 180 ? '4' : car.speed < 230 ? '5' : '6';
      this._gear.innerHTML = gear + ' <span>gear</span>';
    }

    // 圈数
    if (this._lap) this._lap.textContent = Math.min(car.lapCount + 1, game.totalLaps);

    // 位置
    if (this._pos) this._pos.textContent = game.position;

    // 计时
    if (this._raceTimer) this._raceTimer.textContent = this._fmtTime(car.raceTime + car.penaltyTime);
    if (this._lapTimer) this._lapTimer.textContent = car.lapStartTime < 1 ? '00:00.000' : this._fmtTime(car.raceTime - car.lapStartTime);
    if (this._bestLap) this._bestLap.textContent = car.bestLap === Infinity ? '--' : this._fmtTime(car.bestLap);

    // DRS
    if (this._drsLight1) this._drsLight1.classList.toggle('active', game.drsActive);
    if (this._drsLight2) this._drsLight2.classList.toggle('active', game.drsActive);
    if (this._drsStatus) {
      this._drsStatus.textContent = game.drsActive ? '⚡ ACTIVATED' : (game.drsAvailable ? 'READY ✓' : 'LOCKED');
      this._drsStatus.style.color = game.drsActive ? '#00ff88' : (game.drsAvailable ? '#ffd700' : 'rgba(255,255,255,0.3)');
    }

    if (this._drsActiveText) {
      this._drsActiveText.style.display = game.drsActive ? 'block' : 'none';
    }

    // 燃油
    if (this._fuel) {
      this._fuel.textContent = Math.round(car.fuel) + '%';
      this._fuel.style.color = car.fuel < 20 ? '#ff4444' : '#ffd700';
    }

    // 维修区距离
    if (this._pitDist) {
      if (car.pitting) {
        this._pitDist.textContent = '进站中 ' + car.pitTimer.toFixed(1) + 's';
        this._pitDist.style.color = '#ff6600';
      } else if (car.inPitLane) {
        this._pitDist.textContent = '维修区限速';
        this._pitDist.style.color = '#ff6600';
      } else {
        const pitPos = game.track.getPointAt(0.85);
        const dist = Math.round(car.position.distanceTo(pitPos));
        this._pitDist.textContent = dist + 'm';
        this._pitDist.style.color = '#66ccff';
      }
    }

    // 罚时
    if (this._penalty) {
      this._penalty.textContent = '+' + car.penaltyTime.toFixed(1) + 's';
    }

    // 轮胎磨损
    this._tireFills.forEach((fill, i) => {
      if (fill && car.tireWear[i] !== undefined) {
        const wear = car.tireWear[i];
        fill.style.height = (100 - wear) + '%';
        fill.style.background = wear > 70 ? '#ff4444' : wear > 40 ? '#ffaa00' : '#22c55e';
      }
    });

    // 最快圈通知
    if (car.isNewLapBest() && this._bestNotify) {
      this._bestNotify.classList.add('show');
      setTimeout(() => {
        if (this._bestNotify) this._bestNotify.classList.remove('show');
      }, 2000);
    }
  }

  /* ─── 开场动画文字 ─── */
  showTrackName(name, sub) {
    if (this._trackName) {
      this._trackName.innerHTML = `${name}<span class="sub">${sub}</span>`;
      setTimeout(() => {
        if (this._trackName) this._trackName.classList.add('show');
      }, 600);
      setTimeout(() => {
        if (this._trackName) this._trackName.classList.remove('show');
      }, 4000);
    }
  }

  showDRSAnnotation() {
    if (this._drsAnnotation) {
      this._drsAnnotation.classList.add('show');
    }
  }

  hideDRSAnnotation() {
    if (this._drsAnnotation) {
      this._drsAnnotation.classList.remove('show');
    }
  }

  /* ─── 倒计时 3-2-1-GO ─── */
  runCountdown(onComplete) {
    if (this._countdownEl) this._countdownEl.style.display = 'flex';
    let count = 3;

    const doTick = () => {
      if (count > 0) {
        if (this._countNum) {
          this._countNum.textContent = count;
          this._countNum.className = 'countdown-num show';
          setTimeout(() => {
            if (this._countNum) this._countNum.className = 'countdown-num';
          }, 500);
        }
        count--;
        setTimeout(doTick, 900);
      } else {
        // GO!
        if (this._countNum) {
          this._countNum.textContent = 'GO!';
          this._countNum.className = 'countdown-num show go';
        }
        // 闪白特效
        if (this._flashWhite) {
          this._flashWhite.style.opacity = '0.85';
          setTimeout(() => { if (this._flashWhite) this._flashWhite.style.opacity = '0'; }, 200);
        }
        // 引擎音效模拟（实际上无音频，用视觉代替）
        setTimeout(() => {
          if (this._countdownEl) this._countdownEl.style.display = 'none';
          if (onComplete) onComplete();
        }, 500);
      }
    };

    setTimeout(doTick, 500);
  }

  /* ─── 颁奖典礼 ─── */
  showCeremony() {
    if (this._ceremonyEl) this._ceremonyEl.style.display = 'block';
  }

  populateResults(results) {
    if (!this._resultsList || !results) return;
    this._resultsList.innerHTML = '';
    results.forEach((r) => {
      const row = document.createElement('div');
      row.className = 'result-row' + (r.pos <= 3 ? ' p' + r.pos : '');
      const posEmoji = r.pos === 1 ? '🏆' : r.pos === 2 ? '🥈' : r.pos === 3 ? '🥉' : 'P' + r.pos;
      row.innerHTML = `
        <span class="pos">${posEmoji}</span>
        <span class="name">${r.isPlayer ? '⭐ ' : ''}${r.name}</span>
        <span class="time">${r.time}</span>
      `;
      this._resultsList.appendChild(row);
    });

    // 渐入动画
    if (this._podiumTitle) {
      setTimeout(() => this._podiumTitle.classList.add('show'), 500);
    }
    if (this._resultsPanel) {
      setTimeout(() => this._resultsPanel.classList.add('show'), 1000);
    }
    if (this._postBtns) {
      setTimeout(() => this._postBtns.classList.add('show'), 3500);
    }
  }

  /* ─── 轮胎选择 ─── */
  showTireModal() {
    if (this._modalEl) this._modalEl.classList.add('active');
    if (this._tireConfirmBtn) this._tireConfirmBtn.disabled = false;
    // 默认选中中性胎
    this.selectTire('medium');
  }

  hideTireModal() {
    if (this._modalEl) this._modalEl.classList.remove('active');
  }

  selectTire(tire) {
    document.querySelectorAll('.tire-opt').forEach((el) => el.classList.remove('selected'));
    const el = document.querySelector(`.tire-opt[data-tire="${tire}"]`);
    if (el) el.classList.add('selected');
  }

  /* ─── Toast ─── */
  toast(msg, dur = 2500) {
    if (!this._toastEl) return;
    this._toastEl.textContent = msg;
    this._toastEl.style.display = 'block';
    this._toastEl.style.opacity = '1';
    if (this._toastEl._timer) clearTimeout(this._toastEl._timer);
    this._toastEl._timer = setTimeout(() => {
      if (this._toastEl) {
        this._toastEl.style.opacity = '0';
        setTimeout(() => { if (this._toastEl) this._toastEl.style.display = 'none'; }, 300);
      }
    }, dur);
  }

  /* ─── 开/关UI层 ─── */
  showHUD() {
    if (this._hudEl) this._hudEl.classList.add('active');
  }
  hideHUD() {
    if (this._hudEl) this._hudEl.classList.remove('active');
  }
  showOpenerUI() {
    if (this._openerEl) this._openerEl.style.display = 'block';
  }
  hideOpenerUI() {
    if (this._openerEl) this._openerEl.style.display = 'none';
  }

  /* ─── 工具 ─── */
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
