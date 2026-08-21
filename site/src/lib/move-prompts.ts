type PromptToken = { species: string; sport_equipment: string };

const TRICK_MECHANICS: Record<string, string> = {
  "Skateboarding:Ollie": "Crouch, snap the tail against the ground with the back foot, slide the front foot up the grip tape, level the board in the air, and keep both feet over the deck; the board never flips.",
  "Skateboarding:Kickflip": "Set the rear foot on the tail and angle the front foot behind the front bolts. Snap the tail straight down without scooping it sideways. Slide the front foot toward the nose, then flick the FRONT TOES diagonally forward through the HEEL-SIDE corner of the nose. The toe flick initiates exactly one roll around the deck's nose-to-tail axis, opposite a heelflip: grip tape, underside, then grip tape again. The nose stays pointed in the original travel direction during the entire airborne motion: ZERO horizontal turn, ZERO shove-it, ZERO yaw. At the halfway frame the underside faces upward while the nose still points forward. Preserve the source rider's stance and the reference clip's roll direction; never reinterpret it as screen-clockwise or screen-counterclockwise. Lift both feet clear, catch over the bolts only after the grip tape faces upward, then land.",
  "Skateboarding:Heelflip": "Set the rear foot on the tail and the front foot behind the front bolts with the FRONT TOES slightly over the TOE-SIDE edge. Snap the tail, slide the front foot toward the nose, then drive the FRONT HEEL forward and outward through the TOE-SIDE corner of the nose. The heel flick initiates exactly one roll around the deck's nose-to-tail axis, opposite a kickflip: grip tape, underside, then grip tape again. Preserve the source rider's stance and the reference clip's roll direction; never reinterpret it as screen-clockwise or screen-counterclockwise. The board does not yaw or shove-it. Lift both feet clear, catch over the bolts only after the grip tape faces upward, then land.",
  "Skateboarding:Boardslide": "Approach a rail, ollie, turn the board exactly 90 degrees, and place the middle underside of the deck across the rail with both trucks straddling it. Slide perpendicular to the rail, then rotate off; neither truck grinds on the rail.",
  "Skateboarding:50-50 Grind": "Ollie onto a rail with the board parallel to it and lock both trucks onto the rail at the same time. Grind on both axles with all four wheels clear, then pop off straight; the deck itself does not slide on the rail.",
  "Skateboarding:Manual Revert": "Balance only on the rear wheels with the nose visibly raised, then pivot the board and rider 180 degrees on the rear wheels before setting all four wheels down. Do not turn it into an ollie or flip trick.",
  "Skateboarding:360 Flip": "Combine one kickflip rotation with a full 360-degree backside shove-it beneath the rider. The board flips lengthwise and spins horizontally at the same time while the rider's body stays mostly forward, then returns grip-side up for the catch.",
  "Skateboarding:Hardflip": "Pop a frontside shove-it while the front foot drives a kickflip; the board flips steeply between the rider's legs while rotating frontside. It must visibly combine the frontside board spin and kickflip without the rider doing a body flip.",
  "Skateboarding:Impossible": "Scoop the tail so the board wraps vertically around the back foot in one complete end-over-end loop, then unwrap it grip-side up beneath both feet. It is not a flat shove-it or ordinary kickflip.",
  "Skateboarding:Darkslide": "Flip the board upside down onto a rail so the grip-tape side of the deck contacts and slides along the rail while the rider stands on the upward-facing underside, then flip out to wheels-down.",
  "Skateboarding:Laser Flip": "Combine one heelflip rotation with a full 360-degree frontside shove-it. The board flips heel-side and spins horizontally frontside beneath a mostly forward-facing rider, then returns grip-side up for the catch.",
  "Skateboarding:Bigspin Heelflip": "The board performs a 360-degree frontside shove-it plus a heelflip while the rider rotates 180 degrees frontside. Keep the board's heel-side flip, full horizontal spin, and smaller body rotation visually distinct.",
  "Skateboarding:540 Flip": "The board completes a 540-degree horizontal shove-it together with one kickflip beneath the rider. The rider stays upright while the deck makes one and a half flat spins plus one longitudinal flip before the catch.",
  "Skateboarding:720 Gazelle Flip": "Scoop the tail into exactly 720 degrees—two complete turns—of horizontal board rotation while adding one kickflip roll, as the upright rider makes one controlled 360-degree body rotation in the same direction. Keep the board's two flat spins, single nose-to-tail flip, and the rider's one body turn separately readable; no body somersault.",

  "Snowboarding:Ollie": "Compress, load the tail, spring from the rear leg, lift the nose, and level the snowboard in the air with both boots continuously fixed in the two bindings; no board flip or detached feet.",
  "Snowboarding:Indy Grab": "While airborne, bend the knees and use the rear hand to grab the toe-side edge between the bindings. The front hand stays free and both boots remain strapped into separate bindings.",
  "Snowboarding:Method": "While airborne, use the FRONT HAND—not the rear hand—to grab the HEEL-SIDE edge between the bindings. Pull the board upward and behind the hips, arch the back, open the chest, and extend the rear leg so the base becomes visible in the classic method shape; both boots remain locked into separate bindings.",
  "Snowboarding:Boardslide": "Ollie onto a rail, rotate the snowboard 90 degrees, center the base across the rail, and slide with the board perpendicular to the rail before rotating off. Both feet remain in their bindings.",
  "Snowboarding:Frontside 360": "Jump and rotate one full upright 360 with the chest opening toward the direction of travel first, then spot the landing and touch down in the original direction; no inverted flip.",
  "Snowboarding:Backside 360": "Jump and rotate one full upright 360 with the back and rear shoulder leading into the rotation, then spot the landing and touch down in the original direction; no inverted flip.",
  "Snowboarding:Backside 540": "Make one and a half upright backside rotations in the air, led by the rear shoulder, and land riding switch. The board remains attached and there is no cork or somersault.",
  "Snowboarding:Frontside 720": "Complete exactly two upright frontside rotations, chest opening into the spin, then land in the original stance. Keep the spin on a vertical body axis without a flip.",
  "Snowboarding:Cork 720": "Complete two rotations on a clearly tilted, off-axis corkscrew path, with the shoulders dipping below the hips briefly but without a straight head-over-heels flip; land board-base down.",
  "Snowboarding:Rodeo 720": "Launch into an inverted off-axis frontside rodeo, combining a backward/sideways flip with two rotations. The head and shoulders pass below the board before the rider rights the body for landing.",
  "Snowboarding:Double Backflip": "Complete exactly two backward end-over-end somersaults with minimal horizontal spin, keep both boots bound, open after the second flip, and land base-down.",
  "Snowboarding:Double Cork 1080": "Complete three rotations while passing through two distinct off-axis inverted cork phases. The motion is a continuous double-cork 1080, not three flat spins or a straight double backflip.",
  "Snowboarding:Triple Cork 1440": "Complete four rotations with three distinct inverted cork phases, compact in the air, then open and land base-down. Preserve one board and two fixed bindings throughout.",
  "Snowboarding:Switch Quad Cork": "Take off riding switch and perform four distinct off-axis inverted cork phases in one continuous advanced rotation, then return the board base-down for a controlled landing; do not change equipment or detach either foot.",

  "Surfing:Bottom Turn": "Ride down into the wave trough, compress low, set the inside rail, and carve a smooth arcing turn back up the open wave face. Keep both bare feet planted on one surfboard; do not leave the water.",
  "Surfing:Cutback": "From the shoulder, lean onto the rail and carve a broad turn back toward the breaking whitewater, redirecting the board toward the curl before rebounding down the line.",
  "Surfing:Floater": "Drive up the wave face and ride the surfboard along or over the crumbling lip with the board momentarily above the breaking section, then drop back onto the face under control.",
  "Surfing:Snap": "Hit the upper wave face and make a fast, sharp direction change: pivot the board through a tight arc, release the fins briefly, and throw a visible fan of spray before descending.",
  "Surfing:Tube Ride": "Crouch compactly inside the hollow barrel with the curling lip wrapping overhead, maintain the rail line on the wave face, and emerge from the open tube still standing.",
  "Surfing:Layback Hack": "At the lip, pivot the board sharply while laying the upper body back toward the water, trailing one hand on the face, throwing spray, then recover upright over the same board.",
  "Surfing:Air Reverse": "Drive off the lip and rotate board and body about 180 degrees in the air in the surfer's down-the-line rotational direction. Reconnect with the board's nose pointing back toward the wave/whitewater, briefly landing backward, then use the landing slide and whitewater to complete the remaining rotation on the water and ride away. Do not complete the full 360 before contact.",
  "Surfing:Alley-Oop": "Launch above the lip and rotate in the direction opposite the surfer's normal down-the-line travel, keeping the board under both feet before landing back on the wave face.",
  "Surfing:Full Rotation": "Launch above the lip and complete the entire 360-degree flat rotation of surfer and board BEFORE touching the wave. Land with the nose already pointing down the line and continue riding immediately; unlike an air reverse, no remaining half-turn is completed in the whitewater and there is no somersault.",
  "Surfing:Superman Air": "Project above the lip, deliberately kick the surfboard forward, grip both rails with both hands, and push the board away so the surfer's straight body and legs extend backward off the deck in a flying Superman line. Keep hold of the same board, pull it back underneath, replace both bare feet on the deck, bend the knees, and land on the wave face.",
  "Surfing:Backflip": "Launch from the lip and complete one backward head-over-heels somersault with the surfboard held under the feet, then bring the board base-down toward the wave.",
  "Surfing:Double Grab 540": "Launch above the lip, hold the surfboard with both hands, and rotate board and body exactly 540 degrees before releasing the grabs and reconnecting with the wave.",
  "Surfing:No-Grab 720": "Launch above the lip and complete exactly two full aerial rotations with no hand touching the board, feet controlling the deck throughout, then land back on the wave.",
  "Surfing:Impossible Tube Exit": "Travel deep inside a clearly visible barrel, accelerate through the collapsing exit, burst vertically through the lip in a controlled aerial, and reconnect with the open face on the same board.",

  "BMX:Bunny Hop": "Pull the handlebars up to lift the front wheel first, scoop the pedals to lift the rear wheel, level the entire BMX in the air, and land both wheels; both feet stay on two opposite crank pedals.",
  "BMX:Manual": "Balance on the rear wheel with the front wheel visibly raised, arms extended and hips back, while rolling forward without pedaling. The rear wheel stays on the ground and both pedals remain attached 180 degrees apart.",
  "BMX:Barspin": "While airborne, release and spin the handlebars exactly 360 degrees around the steering tube, keep the bike frame beneath the rider, then catch both grips before landing; the frame does not tailwhip.",
  "BMX:Tailwhip": "While holding the handlebars airborne, kick the bike frame into one full 360-degree rotation around the fixed steering axis, keep the rider's body above the bars, then catch the two pedals with both feet.",
  "BMX:Tabletop": "While airborne, tilt and flatten the BMX sideways until the frame and wheels appear table-like and nearly horizontal, turn the bars into the pose, then straighten the bike for landing; no spin or flip.",
  "BMX:Toboggan": "While airborne, turn the handlebars about 90 degrees, release the rear hand to grab the seat, extend the leading arm, pull the bike into the classic stretched toboggan pose, then return both hands to the bars.",
  "BMX:360": "Rotate rider and entire BMX together exactly one full upright 360 degrees around a vertical axis, with no backflip, barspin, or tailwhip, then align both wheels for landing.",
  "BMX:Decade": "Keep both hands on the handlebars while the rider steps off and circles one full 360 degrees around the bike's head tube and bars, the bike staying comparatively centered, then return both feet to the pedals.",
  "BMX:Backflip": "Rotate rider and complete BMX together through one backward end-over-end somersault, keep hands on the grips and feet on opposite pedals, then bring both wheels down for landing.",
  "BMX:Flair": "On a quarter-pipe, combine one backward flip with a 180-degree turn so rider and BMX land traveling back down the transition in the opposite direction.",
  "BMX:Cash Roll": "Rotate rider and BMX together through three readable phases: first an upright 180-degree turn, then one backward end-over-end flip while facing backward, then a final 180-degree turn to face forward again. This is a 180–backflip–180 path, not a flat 360, flair, barrel roll, tailwhip, or ordinary straight backflip.",
  "BMX:Triple Tailwhip": "While airborne and holding the bars, spin the BMX frame exactly three full times around the steering axis beneath the rider, then catch the pedals only after the third rotation.",
  "BMX:Bike Flip": "While airborne, keep the rider comparatively upright holding the handlebars as the BMX frame and wheels rotate through a full backward flip beneath and around the hands, then reconnect feet to pedals.",
  "BMX:Quad Tailwhip 720": "Complete two full body-and-bike spins while simultaneously whipping the bike frame exactly four times around the steering axis, then catch both pedals after all rotations.",

  "Motocross:Seat Grab": "While airborne, keep one hand on its handlebar, release the other hand and reach into the grab hole beneath the rear of the seat. Hold the seat visibly while extending the hips and both legs backward from the footpegs, then pull the body back over the motorcycle, release the seat, re-grip the bar, and replace both boots on the pegs.",
  "Motocross:Can-Can": "While airborne, remove one foot from its footpeg and swing that leg over the seat to the opposite side while the other foot stays planted, then return the leg to its original peg.",
  "Motocross:Nac-Nac": "While airborne, swing one leg behind the seat to the opposite side while twisting the hips away from the motorcycle, then bring that leg back to its original footpeg before landing.",
  "Motocross:Superman": "While holding both handlebars airborne, release both feet from the pegs and extend the entire body straight backward and nearly horizontal behind the motorcycle, then pull both feet back to the pegs.",
  "Motocross:Whip": "While airborne, yaw the motorcycle dramatically sideways relative to the flight path while the rider counterbalances above it, then bring the chassis straight again for landing; do not roll into a tabletop or flip.",
  "Motocross:Heelclicker": "While airborne, keep both hands on the handlebars, remove both boots from the pegs, bring one leg around each outside of the rider's arms, and click the two heels together in front of the rider's chest. The legs visibly wrap around the arms before both boots return to their original pegs.",
  "Motocross:Tsunami": "While holding both handlebars, let the rear of the motorcycle drop as the rider drives both straight legs upward until the boots pass above and beyond the helmet. The rider forms a steep inverted handstand-like line over the bars, then swings both legs back down and replaces both boots on the pegs.",
  "Motocross:Rock Solid": "First extend behind the motorcycle and grip the two under-seat grab holes with BOTH HANDS at the same time. Then release both hands completely and hold a brief straight, unsupported horizontal pose behind the motorcycle with arms spread. Re-grab both seat holes, pull back to the bike, re-grip both handlebars, and replace both boots on the pegs. Do not depict a Holy Grab starting from the handlebars.",
  "Motocross:Backflip": "Rotate rider and motorcycle together through one complete backward end-over-end somersault, maintaining alignment, then bring both wheels down for landing.",
  "Motocross:Double Grab Flip": "During one backward end-over-end motorcycle backflip, release both handlebars and grip the two under-seat grab holes with BOTH HANDS simultaneously while the rider's legs extend behind the bike. Release the double seat grab, return both hands to the handlebars and both boots to the pegs, then finish the same single backflip wheels-down. It is one simultaneous two-hand grab, not two separate grabs.",
  "Motocross:Volt": "While the motorcycle remains relatively level beneath, the rider releases into a full 360-degree horizontal body rotation around the bike, then reconnects hands and boots before landing.",
  "Motocross:Double Backflip": "Rotate rider and motorcycle together through exactly two backward end-over-end somersaults, open after the second rotation, and land both wheels down.",
  "Motocross:Frontflip Flair": "Rotate rider and motorcycle through a forward end-over-end flip combined with a 180-degree twist, then realign the chassis and land facing the reversed direction.",
  "Motocross:Triple Backflip": "Rotate rider and motorcycle together through exactly three backward end-over-end somersaults, keeping one coherent machine and rider, then open for a wheels-down landing.",

  "Skiing:Safety Grab": "While airborne, bend one knee and use the same-side hand to grab the same ski just beneath that boot while the other ski stays parallel; both boots remain fixed to one ski each.",
  "Skiing:Mute Grab": "While airborne, cross the reaching hand over to grab the opposite ski near and in front of the binding, bringing the skis into a controlled crossed mute-grab shape while both boots stay attached.",
  "Skiing:Rail Slide": "Pop onto a rail, rotate both skis 90 degrees so they are perpendicular across it, slide centered with one ski on each foot, then rotate off and land parallel.",
  "Skiing:360": "Rotate skier and both parallel skis together exactly one full upright 360 degrees around a vertical axis, then spot the landing; no inversion or detached ski.",
  "Skiing:Cork 540": "Complete one and a half rotations on a backward-tilted off-axis corkscrew path. The torso leans away from vertical, but in this single cork the ski tips do not pass directly over the head as in a true inverted flip. Uncork and land switch with both skis parallel.",
  "Skiing:Misty 540": "Initiate a forward off-axis flip combined with a 540-degree rotation, with the head dipping forward and sideways, then unwind to land switch on both skis.",
  "Skiing:Misty 720": "Initiate a forward off-axis misty flip while completing two rotations, head and shoulders passing below the hips, then land upright on two parallel skis.",
  "Skiing:Switch 900": "Take off skiing backward, complete exactly two and a half upright rotations, and land facing forward. Keep both skis attached and avoid an inverted cork.",
  "Skiing:Double Cork 1080": "Complete three rotations with two distinct off-axis inverted cork phases, keeping both skis attached and controlled, then open and land on both skis.",
  "Skiing:Bio 1260": "Throw the spin forward onto a low, nearly horizontal bio axis and complete three and a half rotations. The chest leads forward and sideways while the feet stay roughly level with—not directly above—the head, distinguishing the bio from a fully inverted misty. Unwind and land switch on two skis.",
  "Skiing:Triple Cork 1440": "Complete four rotations with three distinct inverted cork phases, tuck both skis together, then open after the final cork and land upright.",
  "Skiing:Switch Double Misty": "Take off backward and perform two connected forward off-axis misty flips with controlled rotation, then bring both skis parallel and land upright.",
  "Skiing:Quad Cork 1800": "Complete five rotations with four distinct off-axis inverted cork phases, keeping two skis and one rider coherent throughout, then open for a controlled landing.",
  "Skiing:Switch Triple Bio": "Take off backward and perform three connected sideways bio-axis inversions with both skis attached, then unwind and land upright on two parallel skis.",
};

const DISCIPLINE_PHYSICS: Record<string, string> = {
  Skateboarding: "Preserve the source rider's regular or goofy stance without mirroring it. There is exactly one rigid skateboard: one deck, two trucks fixed beneath it, and four wheels. Feet may leave the deck only while airborne and must return over the truck bolts.",
  Snowboarding: "Preserve the source rider's regular or goofy stance without mirroring it. There is exactly one snowboard with exactly two bindings fixed to the board; one boot remains locked in each binding for the entire clip.",
  Surfing: "Preserve the source rider's lead foot and direction down the wave without mirroring them. There is exactly one finned surfboard and no bindings; both bare feet control the same deck and the fins remain fixed under the tail.",
  BMX: "There is exactly one complete BMX. Both crank arms are rigidly connected through one crank axle and remain exactly 180 degrees opposite each other; one pedal stays attached to the end of each crank arm. The handlebars rotate only when the named trick requires it, the frame rotates around the steering axis only for a tailwhip, and both wheels remain fixed in the fork and rear dropouts.",
  Motocross: "There is exactly one complete motocross motorcycle with both wheels, frame, fork, engine, seat, handlebars, two footpegs, and controls continuously connected. Hands or boots leave their normal controls only when the named trick specifically requires it, then return before landing.",
  Skiing: "There are exactly two separate skis and two bindings: the left boot remains locked to the left ski and the right boot remains locked to the right ski. Neither ski duplicates, disappears, swaps feet, bends unnaturally, or joins into a snowboard.",
};

const TRICK_DISAMBIGUATION: Record<string, string> = {
  "Skateboarding:Kickflip": "Reject a heelflip, shove-it, varial flip, body spin, or board somersault.",
  "Skateboarding:Heelflip": "Reject a kickflip, shove-it, varial heelflip, body spin, or board somersault.",
  "Skateboarding:Boardslide": "The deck center contacts the rail; neither truck is grinding on it.",
  "Skateboarding:50-50 Grind": "Both metal trucks contact the rail; the center of the wooden deck does not slide on it.",
  "Skateboarding:360 Flip": "Reject a laser flip: this uses a kickflip plus backside 360 shove-it, not a heelflip plus frontside shove-it.",
  "Skateboarding:Hardflip": "Reject an ordinary kickflip or varial kickflip; the frontside shove and steep kickflip must both be visible.",
  "Skateboarding:Impossible": "Reject a flat shove-it or kickflip; the deck must wrap vertically around the rear foot.",
  "Skateboarding:Darkslide": "The grip-tape top of the upside-down deck visibly touches the rail while the rider stands on the upward-facing underside.",
  "Skateboarding:Laser Flip": "Reject a 360 flip: this uses a heelflip plus frontside 360 shove-it, not a kickflip plus backside shove-it.",
  "Snowboarding:Indy Grab": "The rear hand grabs the toe edge between the bindings; reject a method or melon grab.",
  "Snowboarding:Method": "The front hand grabs the heel edge between the bindings; reject an indy grab, rear-hand grab, or simple straight air.",
  "Snowboarding:Boardslide": "The snowboard is perpendicular to the rail with its base centered on the rail; this is not a parallel 50-50.",
  "Surfing:Bottom Turn": "The board stays on the wave and carves from the trough back up the face; reject a top turn, snap, cutback, or aerial.",
  "Surfing:Cutback": "The surfer travels back toward the breaking whitewater, then redirects down the line; reject a single sharp top-turn snap.",
  "Surfing:Snap": "The turn is short and explosive at the lip with fin release and spray; reject a broad roundhouse cutback.",
  "Surfing:Air Reverse": "Only about 180 degrees happens airborne; the remaining rotation happens after reconnection with the wave.",
  "Surfing:Alley-Oop": "The aerial rotation goes opposite the surfer's down-the-line travel; reject an air reverse rotating with that travel.",
  "Surfing:Full Rotation": "All 360 degrees happen airborne before contact; reject an air reverse completed in whitewater.",
  "BMX:Barspin": "Only the handlebar rotates 360 around the steering tube; reject a rotating bicycle frame or tailwhip.",
  "BMX:Tailwhip": "The handlebar/fork stays controlled in the rider's hands while the bicycle frame circles it once; reject a barspin or whole-body 360.",
  "BMX:360": "Rider and complete BMX rotate together as one unit; reject a barspin, tailwhip, or flip.",
  "BMX:Decade": "The rider's body circles the head tube while the bicycle stays comparatively centered; reject a tailwhip in which the frame circles the bars.",
  "BMX:Cash Roll": "Show the ordered 180–backflip–180 phases; reject a flat spin, straight backflip, or flair.",
  "BMX:Bike Flip": "The BMX flips while the rider remains comparatively upright; reject a backflip where rider and bicycle somersault together.",
  "Motocross:Can-Can": "One leg crosses in front of the seat to the opposite side; reject a nac-nac crossing behind the seat.",
  "Motocross:Nac-Nac": "One leg crosses behind the seat to the opposite side; reject a can-can crossing in front.",
  "Motocross:Whip": "The motorcycle yaws sideways relative to its flight path; reject a roll/tabletop or somersault.",
  "Motocross:Rock Solid": "Both hands release from the under-seat double grab; reject a Holy Grab that releases directly from a handlebar Superman.",
  "Motocross:Volt": "The rider makes the 360 beside the comparatively level motorcycle; reject a motorcycle spin, motorcycle flip, or ordinary backflip.",
  "Skiing:Cork 540": "Use a backward-tilted off-axis spin; reject a forward misty, forward bio, flat upright 540, or fully inverted backflip.",
  "Skiing:Misty 540": "Use a forward, genuinely inverted off-axis flip with rotation; reject a backward cork or non-inverted bio.",
  "Skiing:Misty 720": "Use a forward, genuinely inverted off-axis flip with rotation; reject a backward cork or non-inverted bio.",
  "Skiing:Bio 1260": "Use a forward low-axis spin without the skis passing over the head; reject a fully inverted misty or backward cork.",
};

export function movePromptFor(input: { token: PromptToken; discipline: string; trickName: string; outcome: "land" | "fall" }): string {
  const { token, discipline, trickName, outcome } = input;
  const mechanics = TRICK_MECHANICS[`${discipline}:${trickName}`];
  if (!mechanics) throw new Error(`Missing exact motion guide for ${discipline}: ${trickName}.`);
  const physics = DISCIPLINE_PHYSICS[discipline];
  if (!physics) throw new Error(`Missing equipment physics guide for ${discipline}.`);
  const disambiguation = TRICK_DISAMBIGUATION[`${discipline}:${trickName}`] ?? "Do not substitute a different trick or add an unrequested flip, spin, grab, or body rotation.";
  const result = outcome === "land"
    ? "From 3.6–5.0 seconds, finish the required catch or reconnection, land cleanly with knees absorbing impact, and visibly ride away under control."
    : "Perform the complete defining trick correctly through 3.6 seconds. Only during the catch or touchdown, visibly miss the catch or lose the landing, separate safely from the equipment, and do not ride away as though the trick was landed.";
  return `Use Image 1 as the exact character, equipment, clothing, markings, stance, and opening-frame reference. Create one continuous five-second square action-sports shot with no cuts, no slow motion, and no camera orbit. Keep a steady wide three-quarter side view so the full rider and all equipment remain visible at the same time. SUBJECT: the same ${token.species} ${discipline} rider performs exactly one ${trickName} on the same ${token.sport_equipment}. TIMELINE: 0.0–0.8 seconds, show a natural discipline-correct approach and compress for takeoff. 0.8–3.6 seconds, show this exact motion in normal speed: ${mechanics} DISTINGUISH IT: ${disambiguation} EQUIPMENT PHYSICS: ${physics} OUTCOME: ${result} Preserve the character's face, anatomy, body proportions, clothing, fictional sponsor marks, and attached tail. No extra limbs, duplicate or disappearing equipment, floating parts, real trademarks, mutated text, camera cuts, or ambiguous outcome.`;
}

export function hasExactMoveGuide(discipline: string, trickName: string): boolean {
  return Boolean(TRICK_MECHANICS[`${discipline}:${trickName}`]);
}

export function moveRerollPromptFor(basePrompt: string, ownerNote: string): string {
  const correction = ownerNote.trim();
  if (!correction) return basePrompt;
  return `OWNER CORRECTION — THIS OVERRIDES ANY CONFLICTING CREATIVE INTERPRETATION: ${correction} Do not repeat the rejected motion. ${basePrompt}`;
}
