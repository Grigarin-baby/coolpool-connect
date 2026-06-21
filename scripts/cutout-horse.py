#!/usr/bin/env python3
"""Remove the checkerboard background from the carousel-horse JPG → transparent PNG.

Strategy: flood-fill from the image border across "background-like" pixels
(neutral + light = the white/gray checker squares). Because we only remove
pixels connected to the border, the horse's interior white/cream highlights are
preserved. Then crop to content with a little padding.
"""
import sys
from collections import deque
import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT = sys.argv[2]

img = Image.open(SRC).convert("RGB")
arr = np.asarray(img).astype(np.int16)
h, w = arr.shape[:2]

r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
mx = np.maximum(np.maximum(r, g), b)
mn = np.minimum(np.minimum(r, g), b)
neutral = (mx - mn) <= 18          # checker squares are gray/white (R≈G≈B)
light = mn >= 200                  # …and bright
bg_like = neutral & light

# BFS flood fill from every border pixel that is background-like (4-connectivity).
flooded = np.zeros((h, w), dtype=bool)
dq = deque()
for x in range(w):
    for y in (0, h - 1):
        if bg_like[y, x] and not flooded[y, x]:
            flooded[y, x] = True
            dq.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if bg_like[y, x] and not flooded[y, x]:
            flooded[y, x] = True
            dq.append((y, x))

while dq:
    y, x = dq.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and not flooded[ny, nx] and bg_like[ny, nx]:
            flooded[ny, nx] = True
            dq.append((ny, nx))

alpha = np.where(flooded, 0, 255).astype(np.uint8)

# Soften the 1px anti-aliased fringe: any opaque pixel touching a removed one,
# if it's still light+neutral, is likely leftover halo → make it semi/transparent.
fringe = np.zeros((h, w), dtype=bool)
for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
    shifted = np.roll(flooded, (dy, dx), axis=(0, 1))
    fringe |= shifted
halo = fringe & (~flooded) & neutral & (mn >= 215)
alpha[halo] = 90

out = np.dstack([arr.astype(np.uint8), alpha])

# Crop to the opaque content bounding box + padding.
ys, xs = np.where(alpha > 0)
pad = 12
y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, h)
x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, w)
cropped = out[y0:y1, x0:x1]

Image.fromarray(cropped, "RGBA").save(OUT)
print(f"saved {OUT}  size={cropped.shape[1]}x{cropped.shape[0]}  "
      f"removed {flooded.sum()} bg px, {halo.sum()} halo px")
