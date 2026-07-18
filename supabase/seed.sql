insert into public.trick_catalog
  (discipline, catalog_version, trick_id, display_name, difficulty, xp_reward, prerequisite_bitmap, animation_identifier)
values
  (0,1,0,'Ollie',1,100,0,'skate_ollie_v1'), (0,1,1,'Kickflip',3,240,1,'skate_kickflip_v1'),
  (0,1,2,'Heelflip',3,240,1,'skate_heelflip_v1'), (0,1,3,'Boardslide',4,320,1,'skate_boardslide_v1'),
  (1,1,0,'Ollie',1,100,0,'snow_ollie_v1'), (1,1,1,'Indy Grab',2,180,1,'snow_indy_v1'),
  (1,1,2,'Method',4,320,3,'snow_method_v1'), (1,1,3,'Frontside 360',4,320,1,'snow_fs360_v1'),
  (2,1,0,'Bottom Turn',1,100,0,'surf_bottom_turn_v1'), (2,1,1,'Cutback',2,180,1,'surf_cutback_v1'),
  (2,1,2,'Floater',3,240,1,'surf_floater_v1'), (2,1,3,'Tube Ride',5,420,3,'surf_tube_v1'),
  (3,1,0,'Bunny Hop',1,100,0,'bmx_bunny_hop_v1'), (3,1,1,'Manual',2,180,1,'bmx_manual_v1'),
  (3,1,2,'Barspin',3,240,1,'bmx_barspin_v1'), (3,1,3,'Tailwhip',5,420,5,'bmx_tailwhip_v1'),
  (4,1,0,'Seat Grab',1,100,0,'moto_seat_grab_v1'), (4,1,1,'Can-Can',2,180,1,'moto_can_can_v1'),
  (4,1,2,'Nac-Nac',3,240,1,'moto_nac_nac_v1'), (4,1,3,'Superman',5,420,3,'moto_superman_v1'),
  (5,1,0,'Safety Grab',1,100,0,'ski_safety_v1'), (5,1,1,'Mute Grab',2,180,1,'ski_mute_v1'),
  (5,1,2,'Rail Slide',3,240,1,'ski_rail_v1'), (5,1,3,'360',4,320,1,'ski_360_v1')
on conflict (discipline, catalog_version, trick_id) do update set
  display_name = excluded.display_name,
  difficulty = excluded.difficulty,
  xp_reward = excluded.xp_reward,
  prerequisite_bitmap = excluded.prerequisite_bitmap,
  animation_identifier = excluded.animation_identifier;

