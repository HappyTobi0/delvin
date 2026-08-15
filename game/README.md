# Super Devin Bros.

A Mario-style side-scrolling platformer that runs in the browser. No build step, no
dependencies — plain HTML5 canvas and JavaScript.

## Play

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Or just open `index.html` in a browser.

## Controls

| Action  | Keys                                   |
| ------- | -------------------------------------- |
| Move    | `←` `→` or `A` `D`                     |
| Jump    | `Space`, `↑`, or `W` (hold for higher) |
| Run     | `Shift`                                |
| Crouch  | `↓` or `S` (when big)                  |
| Restart | `R`                                    |
| Mute    | `M`                                    |

## Features

- Momentum-based running/jumping with variable jump height and air control
- Tile collision: ground, bricks, `?` blocks, stone stairs, floating platforms, pipes
- Goombas (stompable) and koopas (stomp to shell, kick the shell to bowl over others)
- `?` blocks drop coins or a mushroom; big Mario smashes bricks
- Coins, score popups, lives, level timer, flagpole finish with castle
- Two hand-designed levels with gaps, stair sections and pipe runs
- Parallax hills/clouds/bushes and a chiptune soundtrack + SFX synthesised with WebAudio

## Layout

- `index.html`, `style.css` — page shell
- `game.js` — engine: input, physics, collision, entities, rendering, audio
- `levels.js` — generated level data
- `tools/build_levels.py` — level generator; run it and re-commit `levels.js` after edits

## Level tile legend

| Char | Meaning                        |
| ---- | ------------------------------ |
| `X`  | ground                         |
| `B`  | brick                          |
| `?`  | question block (coin)          |
| `M`  | question block (mushroom)      |
| `U`  | used block                     |
| `S`  | stone stair block              |
| `=`  | floating platform              |
| `P`  | pipe                           |
| `o`  | coin                           |
| `g`  | goomba spawn                   |
| `k`  | koopa spawn                    |
| `F`  | flagpole                       |
