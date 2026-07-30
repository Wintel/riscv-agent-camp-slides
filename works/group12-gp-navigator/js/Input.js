/**
 * ════════════════════════════════════════════════════════════════
 *  Input.js — F1 输入系统
 *  功能：键盘 + 触屏双适配，帧同步信号处理
 *  科普：输入延迟消除 = 每帧直接读取按键状态而非事件驱动
 * ════════════════════════════════════════════════════════════════
 */

export class F1Input {
  constructor() {
    // 键盘按键状态池（每帧读取）
    this.keys = {};
    // 触屏信号（由touch事件设置，gameLoop消费后归零）
    this.onGas = false;
    this.onBrake = false;
    this.onDRS = false;
    this.steerX = 0;         // -1 left, 1 right
    this.autoThrottle = false;

    this._bindKeyboard();
    this._initTouch();
  }

  /* ─── 键盘绑定 ─── */
  _bindKeyboard() {
    const self = this;
    document.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      self.keys[k] = true;
      // DRS — 空格键
      if (e.key === ' ' || k === ' ') {
        e.preventDefault();
        self.onDRS = true;
      }
    });
    document.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      self.keys[k] = false;
      if (e.key === ' ' || k === ' ') {
        self.onDRS = false;
      }
    });
    // 窗口失去焦点时清空所有按键，防止卡键
    window.addEventListener('blur', () => { self.keys = {}; });
  }

  /* ─── 触屏初始化（移动端自动检测） ─── */
  _initTouch() {
    const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) ||
      ('ontouchstart' in window && window.innerWidth < 1024);
    if (!isMobile) return;

    // 暴露自身给全局，供HTML中的ontouchstart/ontouchend回调使用
    window.f1Input = this;

    // 虚拟摇杆
    const area = document.getElementById('touchSteerArea');
    const dot = document.getElementById('touchSteerDot');
    if (area && dot) {
      let tid = -1;
      const self = this;

      const handleStart = (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        tid = t.identifier;
        const r = area.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = t.clientX - cx;
        const dy = t.clientY - cy;
        const maxR = r.width / 2 - 15;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clamped = Math.min(dist, maxR);
        const angle = Math.atan2(dy, dx);
        dot.style.transform = `translate(calc(-50% + ${Math.cos(angle) * clamped}px), calc(-50% + ${Math.sin(angle) * clamped}px))`;
        self.steerX = Math.max(-1, Math.min(1, dx / maxR));
      };

      const handleMove = (e) => {
        e.preventDefault();
        let t = null;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === tid) { t = e.changedTouches[i]; break; }
        }
        if (!t) return;
        const r = area.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = t.clientX - cx;
        const dy = t.clientY - cy;
        const maxR = r.width / 2 - 15;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clamped = Math.min(dist, maxR);
        const angle = Math.atan2(dy, dx);
        dot.style.transform = `translate(calc(-50% + ${Math.cos(angle) * clamped}px), calc(-50% + ${Math.sin(angle) * clamped}px))`;
        self.steerX = Math.max(-1, Math.min(1, dx / maxR));
      };

      const handleEnd = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === tid) {
            tid = -1;
            self.steerX = 0;
            dot.style.transform = 'translate(-50%,-50%)';
            break;
          }
        }
      };

      area.addEventListener('touchstart', handleStart, { passive: false });
      area.addEventListener('touchmove', handleMove, { passive: false });
      area.addEventListener('touchend', handleEnd, { passive: false });
      area.addEventListener('touchcancel', handleEnd, { passive: false });
    }

    // 显示触屏控件
    const tc = document.getElementById('touchControls');
    if (tc) tc.classList.add('active');
  }

  /* ─── 每帧读取输入值 ─── */

  /** 转向值 -1~1 */
  steer() {
    if (this.keys['a'] || this.keys['arrowleft']) return -1;
    if (this.keys['d'] || this.keys['arrowright']) return 1;
    return this.steerX;
  }

  /** 油门值 0~1 */
  throttle() {
    if (this.keys['w'] || this.keys['arrowup']) return 1;
    if (this.onGas) return 1;
    // 自动油门：发车后默认60%油门，玩家踩刹车时自动解除
    if (this.autoThrottle && !this.keys['s']) return 0.35;
    return 0;
  }

  /** 刹车值 0~1 */
  brake() {
    if (this.keys['s'] || this.keys['arrowdown']) return 1;
    if (this.onBrake) return 1;
    return 0;
  }

  /** 视角切换请求（由键盘C/V触发，或被cycleCamera直接调用） */
  get camChangeRequested() {
    if (this.keys['c']) { delete this.keys['c']; return 1; }
    if (this.keys['v']) { delete this.keys['v']; return -1; }
    return 0;
  }

  /** 消耗式读取DRS信号（读取后自动清空，避免重复触发） */
  consumeDRS() {
    const v = this.onDRS;
    // 如果DRS按钮已释放，调用方通过返回false得知
    return v;
  }

  /** 每帧末尾调用：清空DRS指令，由gameLoop管理重置周期 */
  resetDRS() {
    this.onDRS = false;
  }

  /** 重置自动油门（玩家主动刹车时调用） */
  disableAutoThrottle() {
    this.autoThrottle = false;
  }
}
