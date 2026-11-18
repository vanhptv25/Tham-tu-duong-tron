#!/bin/sh
cd "$(dirname "$0")" || exit 1
python3 -m pip install -r requirements.txt || exit 1
echo "Open http://localhost:8080 on the teacher computer"
python3 server.py
