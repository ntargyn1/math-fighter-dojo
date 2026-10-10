<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Math dojo: sound synthesis in sound.ts (WebAudio), belt/wins logic in belts.ts (localStorage); game FX via framer-motion useFightFx hook — keeps game client-only.
- Fighter sprites: strips are re-aligned offline (feet-anchored, uniform frame size) and described in spriteConfig.ts; Fighter reads frame count/size from config, so new strips (e.g. *-ko.png) drop in without code changes to game logic.
