# Gravity Goons trick-motion research

Date: 2026-08-08

## Purpose

The move generator must describe observable body and equipment motion rather than rely on a trick name. `site/src/lib/move-prompts.ts` now contains an exact motion guide for all 84 catalog moves, discipline-specific equipment constraints, and explicit distinctions for tricks a video model commonly confuses.

No existing NFT image or accepted movie is modified by this prompt update. No generation job is submitted by the update itself.

## Sources used

- Seevio generation and reference guidance: <https://seevio.ai/guide>
- Seevio Seedance model pricing: <https://seevio.ai/pricing>
- Skateboard heelflip mechanics: <https://www.skatedeluxe.com/blog/en/trick-tips/skateboard/flat/how-to-heelflip/>
- Skateboard heelflip mechanics and sequence: <https://www.skateboarding.com/how-to/heelflip>
- Snowboard grabs and rotation terminology: <https://www.burton.com/en-us/blogs/the-burton-blog/snowboarding-terms?language=en_US>
- Surfline trick demonstrations: <https://www.surfline.com/surflinetv/trick-tips>
- Surf aerial definitions and biomechanical distinctions: <https://www.scielo.br/j/rbcdh/a/sFKYxyVWJrGPRHF4vyLVkww/?lang=en>
- Superman-air sequence: <https://www.surfertoday.com/surfing/how-to-do-a-superman-air-on-a-surfboard>
- BMX freestyle trick terminology: <https://en.wikipedia.org/wiki/Freestyle_BMX>
- Tailwhip motion and axis: <https://en.wikipedia.org/wiki/Tailwhip>
- Red Bull FMX tricktionary and demonstrations: <https://www.redbull.com/gb-en/fmx-trick-list-dictionary>
- Freeski rotation, cork, misty, and bio terminology: <https://www.ski.com/blog/x-games-dictionary-freeskiing-tricks-explained>

## Important corrections

- Kickflip: the front toes flick through the heel-side nose corner; the deck rolls toward the toes.
- Heelflip: the front heel exits through the toe-side nose corner; the deck rolls away from the toes.
- Snowboard Method: front hand grabs the heel edge between the bindings.
- Surf Air Reverse: about 180 degrees occurs in the air; the remaining rotation finishes after reconnection. A full rotation completes all 360 degrees airborne.
- BMX Cash Roll: ordered 180, backflip, 180 motion.
- FMX Rock Solid: begins with both hands in the under-seat grab holes, releases both hands, then re-grabs the seat. It is not a Holy Grab from the handlebars.
- FMX Double Grab Flip: both hands grab the under-seat holes simultaneously during one backflip.
- BMX hardware: exactly two crank arms remain rigidly opposed by 180 degrees with one attached pedal on each arm.
- Snowboard and ski hardware: two fixed snowboard bindings, or exactly two skis with one bound boot per ski, are invariant throughout a clip.

## Generation policy

- Use the full `seedance-2-0` model rather than `seedance-2-0-fast`.
- Use a single five-second wide shot with explicit setup, defining motion, and outcome phases.
- A FALL movie must perform the correct trick first and fail only at catch, reconnection, or touchdown.
- A reroll rebuilds its base prompt from the current corrected mechanics; it does not reuse the stale rejected prompt.
- Do not accept a clip merely because the character moves. Approval requires the named trick, correct axis/direction, coherent equipment, and an unambiguous LAND or FALL.

## Next reliability tier

Seevio's own guide recommends reference video for complex motion. Prompt text is now substantially stricter, but prose-only image-to-video cannot guarantee a technically exact elite trick. Before scaling paid generation, curate one short, licensed motion-reference clip for each catalog move, upload it to controlled storage, and pass it through Seevio's multimodal/reference-video workflow while retaining the NFT image as the identity reference.
