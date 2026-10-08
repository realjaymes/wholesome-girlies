#!/bin/sh
# Cuts the iPhone install clip shown on /app/ from a raw iPhone screen recording of adding the site to the home
# screen in Safari (iOS 26: ••• > Share > View More > Add to Home Screen > Add).
# The blur boxes hide the status bar, the share sheet's row of contacts and every home screen app except Girlies.
# Their times and positions fit the recording of 8 October 2026 (1284x2778); a new recording needs new times,
# checked frame by frame before it ships, because the contacts row shows real people's names and photos.
#   sh scripts/make-install-clip.sh "~/Downloads/WG PWA Install iphone.MP4"
# Then bump the clip's ?v= in app/index.html (and wg-app.js if it plays there).
set -e
IN="$1"; OUT="$(dirname "$0")/../assets/video/app/install-iphone-safari.mp4"
ffmpeg -loglevel error -y -i "$IN" -filter_complex "[0:v]split=3[base][b][o];[b]boxblur=40:4,split=6[bl0][bl1][bl2][bl3][bl4][bl5];[bl0]crop=1284:130:0:0[c0];[base][c0]overlay=0:0:enable='between(t,0,99)'[v0];[bl1]crop=1284:1050:0:1450[c1];[v0][c1]overlay=0:1450:enable='between(t,2.64,2.95)'[v1];[bl2]crop=1284:520:0:1450[c2];[v1][c2]overlay=0:1450:enable='between(t,2.95,3.75)'[v2];[bl3]crop=1284:1450:0:500[c3];[v2][c3]overlay=0:500:enable='between(t,3.75,4.02)'[v3];[bl4]crop=1284:450:0:520[c4];[v3][c4]overlay=0:520:enable='between(t,4.02,5.75)'[v4];[bl5]crop=1284:2648:0:130[c5];[v4][c5]overlay=0:130:enable='between(t,7.5,99)'[v5];[o]crop=230:290:90:1795[ic];[v5][ic]overlay=90:1795:enable='between(t,7.95,99)'[sharp];[sharp]tpad=stop_mode=clone:stop_duration=1.5,scale=432:-2,format=yuv420p[out]" -map "[out]" -an -c:v libx264 -preset slow -crf 27 -r 30 -movflags +faststart "$OUT"
ffmpeg -loglevel error -y -ss 0.4 -i "$OUT" -frames:v 1 -c:v libwebp -quality 80 "$(dirname "$0")/../assets/img/app/install-iphone-safari.webp"
