type PromptToken = { species: string; sport_equipment: string };

const TRICK_MECHANICS: Record<string, string> = {
  "Skateboarding:Ollie": "Crouch, snap the tail against the ground with the back foot, slide the front foot up the grip tape, level the board in the air, and keep both feet over the deck; the board never flips.",
  "Skateboarding:Kickflip": "Pop the tail, then flick the front toe diagonally off the toe-side edge. The board makes exactly one clean longitudinal kickflip rotation, with no shove-it spin; show both feet above the board before the grip tape returns upward for the catch.",
  "Skateboarding:Heelflip": "Pop the tail, then flick the front heel off the heel-side edge, away from the toes. The board makes exactly one clean longitudinal heel-side flip, opposite a kickflip, with no horizontal shove-it spin; show both feet above the board before the grip tape returns upward for the catch.",
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
  "Skateboarding:720 Gazelle Flip": "The board completes a fast 720-degree horizontal spin with a kickflip while the upright rider rotates a controlled 360 degrees. Keep board spin, board flip, and body rotation distinct; no body somersault.",

  "Snowboarding:Ollie": "Compress, load the tail, spring from the rear leg, lift the nose, and level the snowboard in the air with both boots continuously fixed in the two bindings; no board flip or detached feet.",
  "Snowboarding:Indy Grab": "While airborne, bend the knees and use the rear hand to grab the toe-side edge between the bindings. The front hand stays free and both boots remain strapped into separate bindings.",
  "Snowboarding:Method": "While airborne, use the rear hand to grab the heel-side edge between the bindings, arch the back, extend the hips, and pull the board behind the body in a clear method shape; both boots stay bound.",
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
  "Surfing:Air Reverse": "Launch completely above the lip, rotate board and body through a reverse aerial rotation, keep both feet over the deck, and reconnect with the wave facing back down the line.",
  "Surfing:Alley-Oop": "Launch above the lip and rotate in the direction opposite the surfer's normal down-the-line travel, keeping the board under both feet before landing back on the wave face.",
  "Surfing:Full Rotation": "Launch above the lip and complete one clear 360-degree aerial rotation with board and body together, then reconnect fins-first with the wave; no somersault.",
  "Surfing:Superman Air": "Launch above the lip, grip the board with both hands as both feet extend backward off the deck in a Superman pose, then pull the board back under the feet before landing.",
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
  "BMX:Cash Roll": "Perform a corked 360-degree backflip: initiate a 180 turn into an off-axis backward roll, continue the rotation, and bring rider and BMX upright together for landing.",
  "BMX:Triple Tailwhip": "While airborne and holding the bars, spin the BMX frame exactly three full times around the steering axis beneath the rider, then catch the pedals only after the third rotation.",
  "BMX:Bike Flip": "While airborne, keep the rider comparatively upright holding the handlebars as the BMX frame and wheels rotate through a full backward flip beneath and around the hands, then reconnect feet to pedals.",
  "BMX:Quad Tailwhip 720": "Complete two full body-and-bike spins while simultaneously whipping the bike frame exactly four times around the steering axis, then catch both pedals after all rotations.",

  "Motocross:Seat Grab": "While airborne with the motorcycle stable, release one hand, reach back and visibly grab the seat, extend the free arm, then return the hand to the handlebar before landing.",
  "Motocross:Can-Can": "While airborne, remove one foot from its footpeg and swing that leg over the seat to the opposite side while the other foot stays planted, then return the leg to its original peg.",
  "Motocross:Nac-Nac": "While airborne, swing one leg behind the seat to the opposite side while twisting the hips away from the motorcycle, then bring that leg back to its original footpeg before landing.",
  "Motocross:Superman": "While holding both handlebars airborne, release both feet from the pegs and extend the entire body straight backward and nearly horizontal behind the motorcycle, then pull both feet back to the pegs.",
  "Motocross:Whip": "While airborne, yaw the motorcycle dramatically sideways relative to the flight path while the rider counterbalances above it, then bring the chassis straight again for landing; do not roll into a tabletop or flip.",
  "Motocross:Heelclicker": "While airborne, lift both feet off the pegs and bring both heels together in front of and above the handlebars, one leg on each side, then return both boots to their pegs.",
  "Motocross:Tsunami": "Hold the handlebars while kicking both feet high above and forward over the rider's head, creating a steep handstand-like inverted body line behind the motorcycle, then return to the pegs.",
  "Motocross:Rock Solid": "After extending into a Superman, release both hands as well so the rider is fully separated in a straight horizontal pose above and behind the motorcycle, then re-grab the bars and recover.",
  "Motocross:Backflip": "Rotate rider and motorcycle together through one complete backward end-over-end somersault, maintaining alignment, then bring both wheels down for landing.",
  "Motocross:Double Grab Flip": "During one backward motorcycle flip, release into two clearly distinct grabs in sequence, return both hands to the handlebars, and finish the single rotation wheels-down.",
  "Motocross:Volt": "While the motorcycle remains relatively level beneath, the rider releases into a full 360-degree horizontal body rotation around the bike, then reconnects hands and boots before landing.",
  "Motocross:Double Backflip": "Rotate rider and motorcycle together through exactly two backward end-over-end somersaults, open after the second rotation, and land both wheels down.",
  "Motocross:Frontflip Flair": "Rotate rider and motorcycle through a forward end-over-end flip combined with a 180-degree twist, then realign the chassis and land facing the reversed direction.",
  "Motocross:Triple Backflip": "Rotate rider and motorcycle together through exactly three backward end-over-end somersaults, keeping one coherent machine and rider, then open for a wheels-down landing.",

  "Skiing:Safety Grab": "While airborne, bend one knee and use the same-side hand to grab the same ski just beneath that boot while the other ski stays parallel; both boots remain fixed to one ski each.",
  "Skiing:Mute Grab": "While airborne, cross the reaching hand over to grab the opposite ski near and in front of the binding, bringing the skis into a controlled crossed mute-grab shape while both boots stay attached.",
  "Skiing:Rail Slide": "Pop onto a rail, rotate both skis 90 degrees so they are perpendicular across it, slide centered with one ski on each foot, then rotate off and land parallel.",
  "Skiing:360": "Rotate skier and both parallel skis together exactly one full upright 360 degrees around a vertical axis, then spot the landing; no inversion or detached ski.",
  "Skiing:Cork 540": "Complete one and a half rotations on a tilted off-axis corkscrew path, shoulders dipping below the hips briefly, then land facing backward with both skis parallel.",
  "Skiing:Misty 540": "Initiate a forward off-axis flip combined with a 540-degree rotation, with the head dipping forward and sideways, then unwind to land switch on both skis.",
  "Skiing:Misty 720": "Initiate a forward off-axis misty flip while completing two rotations, head and shoulders passing below the hips, then land upright on two parallel skis.",
  "Skiing:Switch 900": "Take off skiing backward, complete exactly two and a half upright rotations, and land facing forward. Keep both skis attached and avoid an inverted cork.",
  "Skiing:Double Cork 1080": "Complete three rotations with two distinct off-axis inverted cork phases, keeping both skis attached and controlled, then open and land on both skis.",
  "Skiing:Bio 1260": "Complete three and a half rotations on a sideways, nearly horizontal bio axis, body laid out across the spin rather than flipping straight backward, then land switch.",
  "Skiing:Triple Cork 1440": "Complete four rotations with three distinct inverted cork phases, tuck both skis together, then open after the final cork and land upright.",
  "Skiing:Switch Double Misty": "Take off backward and perform two connected forward off-axis misty flips with controlled rotation, then bring both skis parallel and land upright.",
  "Skiing:Quad Cork 1800": "Complete five rotations with four distinct off-axis inverted cork phases, keeping two skis and one rider coherent throughout, then open for a controlled landing.",
  "Skiing:Switch Triple Bio": "Take off backward and perform three connected sideways bio-axis inversions with both skis attached, then unwind and land upright on two parallel skis.",
};

export function movePromptFor(input: { token: PromptToken; discipline: string; trickName: string; outcome: "land" | "fall" }): string {
  const { token, discipline, trickName, outcome } = input;
  const mechanics = TRICK_MECHANICS[`${discipline}:${trickName}`];
  if (!mechanics) throw new Error(`Missing exact motion guide for ${discipline}: ${trickName}.`);
  const result = outcome === "land"
    ? "Complete that exact motion, catch or reconnect correctly, land cleanly, and ride away under full control."
    : "Show that exact trick clearly before the landing, then miss the catch or recovery, fall or step away safely, and do not land the trick.";
  return `Five-second square action-sports broadcast clip. Preserve the exact identity, species, face, body, clothing, fictional sponsor marks, stance, and ${token.sport_equipment} from the source image. The ${token.species} ${discipline} rider performs a ${trickName}. Exact motion: ${mechanics} Outcome: ${result} Keep the full rider and equipment visible during the defining motion. Show one coherent rider and one complete set of discipline-correct equipment. Keep anatomy, pedals, bindings, boards, skis, wheels, handlebars, fins, and tail attachment physically correct. No extra limbs, duplicate equipment, real trademarks, text mutation, camera cuts, or outcome ambiguity.`;
}

export function hasExactMoveGuide(discipline: string, trickName: string): boolean {
  return Boolean(TRICK_MECHANICS[`${discipline}:${trickName}`]);
}
