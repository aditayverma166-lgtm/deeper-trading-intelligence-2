
# Deeper Trading Intelligence

A Node.js starter web app for a Deeepr-style trading research dashboard.

## Included
- Delta Exchange India public OHLC candle data
- BTCUSD / ETHUSD
- 5m / 15m / 1h / 4h / 1d
- Candlestick chart
- EMA 9 / EMA 20
- RSI / ATR
- Basic LONG / SHORT / WAIT rule engine
- Entry / SL / TP1 / TP2
- Mobile-friendly dashboard
- Strategy rule input area

## Run locally
1. Install Node.js 18+.
2. Extract this ZIP.
3. Open a terminal in the folder.
4. Run `npm install` (there are no external server dependencies, but this confirms npm setup).
5. Run `npm start`.
6. Open `http://localhost:3000`.

## Deploy on Render
Create a GitHub repository, upload these files, then create a Render Web Service from the repository.
- Build Command: `npm install`
- Start Command: `npm start`

## Important
This is a functional starter build, not a finished copy of Deeepr.ai. The Flow, News and Macro panels are placeholders. The strategy text box is not yet a natural-language compiler. Historical pattern matching, walk-forward testing, trading fees, funding, slippage, database/authentication and production monitoring should be added before relying on results.
