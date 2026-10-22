#!/usr/bin/env bash
# Cloudflare Pages build for wholesomegirlies.xyz (phase 8 of the Selar to Bachs migration).
# It runs the same page check as the GitHub Pages workflow. A failed check fails the build, and
# Cloudflare keeps the last good deploy live. The site is the repo root, so the build output
# directory is "." and Pages picks up functions/ and _routes.json from it.
# Pages settings: build command "bash scripts/cf-build.sh", output directory ".".
# Bindings (Settings, Variables and Secrets): GATE_SECRET (secret, the same value as the payment server's)
# and PAY_API (plain, the payment server address, optional: it lets the gate refuse a made-up ?order=).
set -e
python3 scripts/check-pages.py
