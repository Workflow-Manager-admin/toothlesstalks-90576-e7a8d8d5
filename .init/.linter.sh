#!/bin/bash
cd /home/kavia/workspace/code-generation/toothlesstalks-90576-e7a8d8d5/frontend_web_app
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

