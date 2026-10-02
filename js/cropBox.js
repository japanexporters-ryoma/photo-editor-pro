const MIN_DRAG_SIZE = 16;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// 切り取り枠。位置と大きさは元画像のピクセル座標（整数）で持ち、
// 表示するときだけ scale を掛ける。
export class CropBox {
  constructor(el, onChange) {
    this.el = el;
    this.onChange = onChange;
    this.imgW = 0;
    this.imgH = 0;
    this.scale = 1;
    this.rect = null;
    this.drag = null;

    el.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    el.addEventListener('pointermove', (e) => this.onPointerMove(e));
    el.addEventListener('pointerup', (e) => this.onPointerEnd(e));
    el.addEventListener('pointercancel', (e) => this.onPointerEnd(e));
  }

  setImage(imgW, imgH) {
    this.imgW = imgW;
    this.imgH = imgH;
    this.rect = null;
    this.drag = null;
    this.render();
  }

  setScale(scale) {
    this.scale = scale;
    this.render();
  }

  // 画像中央に w×h の枠を置く。画像に収まるよう丸めたら true を返す。
  place(w, h) {
    const cw = clamp(w, 1, this.imgW);
    const ch = clamp(h, 1, this.imgH);
    this.update({
      x: Math.round((this.imgW - cw) / 2),
      y: Math.round((this.imgH - ch) / 2),
      w: cw,
      h: ch,
    });
    return cw !== w || ch !== h;
  }

  // 左上を保ったまま大きさを変える。はみ出す分は左上へずらす。
  resize(w, h) {
    const cw = clamp(w, 1, this.imgW);
    const ch = clamp(h, 1, this.imgH);
    this.update({
      x: Math.min(this.rect.x, this.imgW - cw),
      y: Math.min(this.rect.y, this.imgH - ch),
      w: cw,
      h: ch,
    });
    return cw !== w || ch !== h;
  }

  update(rect) {
    this.rect = rect;
    this.render();
    this.onChange(rect);
  }

  render() {
    const { el, rect, scale } = this;
    el.hidden = !rect;
    if (!rect) return;
    el.style.transform = `translate(${rect.x * scale}px, ${rect.y * scale}px)`;
    el.style.width = `${rect.w * scale}px`;
    el.style.height = `${rect.h * scale}px`;
  }

  onPointerDown(e) {
    if (this.drag || !this.rect) return;
    e.preventDefault();
    this.el.setPointerCapture(e.pointerId);
    this.drag = {
      pointerId: e.pointerId,
      handle: e.target.dataset.handle || null,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...this.rect },
    };
  }

  onPointerMove(e) {
    const { drag } = this;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = Math.round((e.clientX - drag.startX) / this.scale);
    const dy = Math.round((e.clientY - drag.startY) / this.scale);
    this.update(drag.handle ? this.resized(drag, dx, dy) : this.moved(drag, dx, dy));
  }

  onPointerEnd(e) {
    if (this.drag && e.pointerId === this.drag.pointerId) this.drag = null;
  }

  moved({ startRect: s }, dx, dy) {
    return {
      x: clamp(s.x + dx, 0, this.imgW - s.w),
      y: clamp(s.y + dy, 0, this.imgH - s.h),
      w: s.w,
      h: s.h,
    };
  }

  resized({ startRect: s, handle }, dx, dy) {
    const minW = Math.min(MIN_DRAG_SIZE, s.w);
    const minH = Math.min(MIN_DRAG_SIZE, s.h);
    let left = s.x;
    let top = s.y;
    let right = s.x + s.w;
    let bottom = s.y + s.h;

    if (handle.includes('w')) left = clamp(left + dx, 0, right - minW);
    if (handle.includes('e')) right = clamp(right + dx, left + minW, this.imgW);
    if (handle.includes('n')) top = clamp(top + dy, 0, bottom - minH);
    if (handle.includes('s')) bottom = clamp(bottom + dy, top + minH, this.imgH);

    return { x: left, y: top, w: right - left, h: bottom - top };
  }
}
