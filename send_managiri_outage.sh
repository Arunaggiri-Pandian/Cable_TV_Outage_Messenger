#!/bin/bash

curl -X POST http://127.0.0.1:8501/api/send \
     -H "Content-Type: application/json" \
     -d '{
           "area": "Managiri",
           "channel": "whatsapp",
           "msg_type": "outage",
           "dry_run": false,
           "eta_start": "11:00",
           "eta_end": "13:00",
           "pricing_category": "utility",
           "langs": {"en": true, "ta": false}
         }'
