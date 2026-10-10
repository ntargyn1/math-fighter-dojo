# Math Fight Dojo

Prompt для Lovable (можно копировать целиком)

Create a kid-friendly web game for mobile called Math Fighting Dojo for a 7-year-old child.

The core idea:

It is a simple stickman fighting game where math problems are used as attacks.

The game should run well on a phone screen and use big buttons and simple UI.

Main screens:

Home screen

Title: “Math Fighting Dojo”.

Buttons: “Play Battle”, “Training”, “Settings”.

Simple background (dojo or arena style, but very minimal).

Battle screen

At the top: NPC stickman with a health bar (start at 300%).

At the bottom: Player stickman with a health bar (start at 100%).

Show a combo meter for the player (0 to 3).

In the center:

A math question (for example: 3 + 4 = ?).

Three big answer buttons (only one is correct).

A countdown timer starting from 5 seconds.

The layout must be vertical and comfortable for one-hand use on a phone.

Game logic requirements:

When a battle starts:

Generate a math problem based on the current level.

Show three answer options in random order (one correct, two incorrect).

Start a 5-second timer for the question.

When the player taps an answer:

Measure how many seconds passed since the question appeared.

If the answer is correct and time <= 1 second:

Deal big damage to NPC (for example 30%).

Increase combo count by 1.

If the answer is correct but time > 1 second:

Deal small damage to NPC (for example 15%).

Reset combo count to 0.

If the answer is wrong:

NPC deals 10% damage to the player.

Reset combo count to 0.

Combo and ultimate attack:

If the player gets 3 correct answers in a row within 1 second each, trigger an ultimate attack:

Show a special animation or text like “ULTIMATE STRIKE!”.

Deal very big damage (for example 100% or more) so that the NPC can be defeated immediately.

After the ultimate, reset combo count to 0.

Win / lose:

If NPC health reaches 0 or less: show a “Victory” screen with a button “Play again” and “Back to home”.

If player health reaches 0 or less: show a “Try again” screen with a friendly message and a button “Retry battle”.

Math difficulty progression:

Use a simple level system.

Early levels (1–5): addition within 0–10 (examples like 2+3, 7+1).

Levels 6–10: addition within 0–20.

Levels 11–15: subtraction within 0–10.

Levels 16–20: mixed addition and subtraction within 0–20.

Make it easy to change or extend this logic in code (for example, a function generateQuestion(level)).

Training mode:

Create a Training screen:

No health bars, no damage.

Show one math question and three answer buttons.

After answering, show a short helper text like:

“To do 9 + 1, just move one step from 9 to 10.”

Add a button “Back to home”.

This screen is for calm practice without any fighting.

Technical details:

Build this as a React web app.

Use simple state management (React state or hooks) for:

Player health (playerHealth).

NPC health (npcHealth).

Current level (currentLevel).

Combo count (comboCount).

Current question object (currentQuestion with fields like a, b, operator, correctAnswer).

Answer options array (answerOptions).

Timer (timeRemaining or actual elapsed time from question start).

The design must:

Work well on mobile (responsive, vertical layout).

Use large tap areas for answer buttons.

Have simple colors and friendly fonts (no dark, scary theme).

Please:

Generate the full UI and basic game logic for the Home screen, Battle screen, and Training screen.

Add placeholder functions for animations (for example call a function when a hit happens), so I can later improve visuals.

Organize the code in clear components (for example: HomeScreen, BattleScreen, TrainingScreen, HealthBar, etc.).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://math-fighter-dojo.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/59cdc957-1bb2-4803-9472-6efc07a657da).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
