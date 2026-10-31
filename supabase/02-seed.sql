-- =====================================================================================
-- Ultimate Connect : contenu de départ (après 01-schema.sql)
--
-- Codes d'inscription, dates du voyage, les deux groupes (vols), la liste des participants, le programme officiel
-- jour par jour, guide pratique.
-- Peut être relancé : rien de ce que vous avez modifié n'est écrasé (les jours du programme que le staff a retouchés
-- dans l'appli, les codes, les groupes et les participants déjà présents restent tels quels).
-- A la fin, la table affichée donne le code des consultants et le code du staff.
-- =====================================================================================

-- ---------- codes d'inscription ----------
-- Consultants : changez-le quand vous voulez depuis l'appli (Profil du staff).
insert into public.config (key, value) values ('invite_code', 'UHB-2026') on conflict (key) do nothing;
-- Staff : tiré au hasard. Il se change avec :  update public.config set value = 'MON-CODE' where key = 'staff_code';
insert into public.config (key, value)
values ('staff_code', 'STAFF-' || substr(upper(md5(random()::text || clock_timestamp()::text)), 1, 8))
on conflict (key) do nothing;

-- ---------- le voyage ----------
insert into public.trip (id, name, start_date, end_date)
values ('current', 'Voyage Istanbul 2026', '2026-11-05T12:00:00Z', '2026-11-09T12:00:00Z')
on conflict (id) do nothing;

insert into public.chat_meta (id, locked) values ('group', false) on conflict (id) do nothing;

-- ---------- les deux groupes : mêmes jours, pas les mêmes vols (heures LOCALES ; Istanbul = Alger + 2 h) ----------
-- Pour changer une heure plus tard :  update public.trip_groups set out_dep = '10:00' where id = 1;
-- (le programme du jour, lui, se retouche dans l'appli : onglet Programme du staff).
insert into public.trip_groups
  (id, name, airline, out_date, out_from, out_to, out_dep, out_arr,
   back_date, back_from, back_to, back_dep, back_arr,
   meet_time, meet_place, bag_hold_kg, bag_hold_count, bag_cabin_kg, hotel_arrival, checkout_by, note, meet_place_ar, note_ar)
values
(1, 'Groupe 1', 'Air Algérie',
 '2026-11-05', 'Alger · Houari Boumediene (ALG)', 'Istanbul Airport (IST)', '09:40', '15:15',
 '2026-11-09', 'Istanbul Airport (IST)', 'Alger · Houari Boumediene (ALG)', '20:30', '22:00',
 '06:30', 'Dans l''aéroport Houari Boumediene : le staff vous contacte sur place', 23, 2, 10, '18:00', null, '',
 'داخل مطار هواري بومدين: سيتواصل معكم الفريق هناك', ''),
(2, 'Groupe 2', 'Pegasus Airlines',
 '2026-11-05', 'Alger · Houari Boumediene (ALG)', 'Istanbul Sabiha Gökçen (SAW)', '12:55', '18:30',
 '2026-11-09', 'Istanbul Sabiha Gökçen (SAW)', 'Alger · Houari Boumediene (ALG)', '09:45', '11:35',
 '10:30', 'Dans l''aéroport Houari Boumediene : le staff vous contacte sur place', 20, 1, 8, '22:00', '05:00',
 'Votre avion se pose à l''aéroport Sabiha Gökçen (côté asiatique d''Istanbul), pas à l''aéroport d''Istanbul.',
 'داخل مطار هواري بومدين: سيتواصل معكم الفريق هناك',
 'ستهبط طائرتكم في مطار صبيحة غوكتشن (الجانب الآسيوي من إسطنبول)، وليس في مطار إسطنبول.')
on conflict (id) do nothing;
-- Groupe 1 : DEUX bagages de 23 kg en soute (« 23 kg x 2 »). Une base qui a reçu une version plus ancienne de ce fichier
-- (un seul bagage) est corrigée ; un poids ou un nombre que le staff a changé lui-même n'est pas touché.
update public.trip_groups set bag_hold_count = 2 where id = 1 and bag_hold_kg = 23 and bag_hold_count = 1;

-- ---------- la liste des participants : leurs comptes sont déjà prêts ----------
-- Chaque personne s'inscrit avec le code consultants, puis touche SON nom dans la liste : elle arrive avec son groupe,
-- ses vols, et son compte est validé d'office. Ajouter quelqu'un plus tard :
--   insert into public.roster (full_name, group_id) values ('Prénom Nom', 1);
insert into public.roster (full_name, role, group_id) values
('Khiter Lahouaria', 'consultant', 1),
('Hassiba Benabdallah', 'consultant', 1),
('Moulay Jihane Soumia', 'consultant', 1),
('Aitramdane Oualid', 'consultant', 1),
('Hamza Bouguerra', 'consultant', 1),
('Fouad Mehabli', 'consultant', 1),
('Ouahiba Louafi', 'consultant', 1),
('Meriem Cheniki', 'consultant', 1),
('Chaima Kherbouche', 'consultant', 1),
('Berbar Amel', 'consultant', 1),
('Fatma Baouche', 'consultant', 1),
('Walid Mohamed Hansali', 'consultant', 1),
('Souhila Mokhtari', 'consultant', 1),
('Cheikh Aida', 'consultant', 1),
('Khentit Khaoula', 'consultant', 2),
('Maarouk Louai', 'consultant', 2),
('Kaced Belkacem', 'consultant', 2),
('Kennab Mustapha', 'consultant', 2),
('Soumia Khebrara', 'consultant', 2),
('Oukerimi Tayeb', 'consultant', 2),
('Belbachir Mkhaissi', 'consultant', 2)
on conflict (full_name) do nothing;

-- L'équipe : elle s'inscrit avec le code du STAFF et touche son nom dans la liste (même principe que les participants).
-- Zineddine voyage avec le groupe 2 ; Hichem, Samy et Yazid avec le groupe 1.
insert into public.roster (full_name, role, group_id) values
('Zineddine', 'staff', 2),
('Hichem', 'staff', 1),
('Samy', 'staff', 1),
('Yazid', 'staff', 1)
on conflict (full_name) do nothing;

-- ---------- programme officiel (heures locales d'Istanbul = Alger + 2 h) ----------
-- "—" = pas d'heure précise : la ligne s'affiche en premier de la journée.
-- "group" : la ligne ne concerne que ce groupe (sans "group" = tout le monde). Les identifiants "o1", "o2"… sont ceux de ce fichier :
-- si vous relancez le fichier, un jour dont toutes les lignes portent encore ces identifiants est remis à jour ; dès que le staff
-- y a ajouté ou retiré une ligne dans l'appli, il n'est plus touché.
insert into public.schedule as s (date, items) values
('2026-11-05', '[
  {"id":"o1","time":"06:30","title":"Rendez-vous à l''aéroport d''Alger (dans l''aéroport Houari Boumediene : le staff vous contacte sur place)","titleAr":"اللقاء في مطار الجزائر (داخل مطار هواري بومدين: سيتواصل معكم الفريق هناك)","important":true,"createdBy":"","group":1},
  {"id":"o2","time":"09:40","title":"Envol d''Alger vers Istanbul (Air Algérie)","titleAr":"الإقلاع من الجزائر نحو إسطنبول (الخطوط الجوية الجزائرية)","important":true,"createdBy":"","group":1},
  {"id":"o3","time":"15:15","title":"Atterrissage à l''aéroport d''Istanbul, IST (heure locale : Alger + 2 h)","titleAr":"الهبوط في مطار إسطنبول IST (التوقيت المحلي: توقيت الجزائر + ساعتان)","important":false,"createdBy":"","group":1},
  {"id":"o4","time":"18:00","title":"Arrivée à l''hôtel (environ) et installation dans les chambres","titleAr":"الوصول إلى الفندق (تقريباً) والاستقرار في الغرف","important":true,"createdBy":"","group":1},
  {"id":"o5","time":"19:00","title":"Soirée libre : repos ou sortie (idées dans l''onglet Carte, puis Idées de sorties)","titleAr":"سهرة حرة: راحة أو خروج (أفكار في تبويب «الخريطة» ثم «أفكار للخروج»)","important":false,"createdBy":"","group":1},
  {"id":"o6","time":"10:30","title":"Rendez-vous à l''aéroport d''Alger (dans l''aéroport Houari Boumediene : le staff vous contacte sur place)","titleAr":"اللقاء في مطار الجزائر (داخل مطار هواري بومدين: سيتواصل معكم الفريق هناك)","important":true,"createdBy":"","group":2},
  {"id":"o7","time":"12:55","title":"Envol d''Alger vers Istanbul (Pegasus Airlines)","titleAr":"الإقلاع من الجزائر نحو إسطنبول (بيغاسوس)","important":true,"createdBy":"","group":2},
  {"id":"o8","time":"18:30","title":"Atterrissage à l''aéroport Sabiha Gökçen, SAW (heure locale : Alger + 2 h)","titleAr":"الهبوط في مطار صبيحة غوكتشن SAW (التوقيت المحلي: توقيت الجزائر + ساعتان)","important":false,"createdBy":"","group":2},
  {"id":"o9","time":"22:00","title":"Arrivée à l''hôtel (environ) et installation dans les chambres : repos","titleAr":"الوصول إلى الفندق (تقريباً) والاستقرار في الغرف: راحة","important":true,"createdBy":"","group":2}
]'::jsonb),
('2026-11-06', '[
  {"id":"o1","time":"—","title":"Petit-déjeuner inclus à l''hôtel, puis le matin : Réunion Ultimate (formation) dans la salle de formation de l''hôtel (début entre 9h et 10h), jusqu''à 12:30 environ","titleAr":"الفطور مشمول في الفندق، ثم صباحاً: اجتماع Ultimate (التكوين) في قاعة التكوين بالفندق (البداية بين التاسعة والعاشرة)، إلى حوالي 12:30","important":true,"createdBy":""},
  {"id":"o2","time":"13:00","title":"On sort de l''hôtel : balade du Bosphore, départ d''Eminönü","titleAr":"الخروج من الفندق: جولة البوسفور، الانطلاق من إمينونو (Eminönü)","important":true,"createdBy":""},
  {"id":"o3","time":"17:00","title":"Fin de la balade (environ) : temps libre, retour à l''hôtel avant 22:00 (idées dans l''onglet Carte)","titleAr":"نهاية الجولة (تقريباً): وقت حر، العودة إلى الفندق قبل 22:00 (أفكار في تبويب «الخريطة»)","important":false,"createdBy":""}
]'::jsonb),
('2026-11-07', '[
  {"id":"o1","time":"—","title":"Petit-déjeuner inclus à l''hôtel, puis visite autour de la mosquée Sultan Ahmed (la Mosquée Bleue). L''heure du départ vous est donnée par le staff.","titleAr":"الفطور مشمول في الفندق، ثم جولة حول مسجد السلطان أحمد (المسجد الأزرق). يعلمكم الفريق بوقت الانطلاق.","important":true,"createdBy":""}
]'::jsonb),
('2026-11-08', '[
  {"id":"o1","time":"—","title":"Journée libre ! Petit-déjeuner inclus à l''hôtel, puis à vous de choisir : 3 idées dans l''onglet Carte, puis Idées de sorties. Retour à l''hôtel avant 22:00.","titleAr":"يوم حر! الفطور مشمول في الفندق، ثم الاختيار لكم: 3 أفكار في تبويب «الخريطة» ثم «أفكار للخروج». العودة إلى الفندق قبل 22:00.","important":false,"createdBy":""}
]'::jsonb),
('2026-11-09', '[
  {"id":"o1","time":"—","title":"Petit-déjeuner inclus à l''hôtel. L''heure du check-out et du départ pour l''aéroport vous est donnée par le staff.","titleAr":"الفطور مشمول في الفندق. يعلمكم الفريق بوقت مغادرة الفندق والتوجه إلى المطار.","important":true,"createdBy":"","group":1},
  {"id":"o2","time":"20:30","title":"Envol d''Istanbul vers Alger (Air Algérie)","titleAr":"الإقلاع من إسطنبول نحو الجزائر (الخطوط الجوية الجزائرية)","important":true,"createdBy":"","group":1},
  {"id":"o3","time":"22:00","title":"Arrivée à Alger (heure locale)","titleAr":"الوصول إلى الجزائر (التوقيت المحلي)","important":false,"createdBy":"","group":1},
  {"id":"o4","time":"05:00","title":"Check-out de l''hôtel avant 05:00 (préparez vos valises la veille), puis départ pour l''aéroport Sabiha Gökçen : l''heure exacte vous est donnée par le staff","titleAr":"مغادرة الفندق قبل الساعة 05:00 (حضّروا حقائبكم في الليلة السابقة)، ثم التوجه إلى مطار صبيحة غوكتشن: يعلمكم الفريق بالوقت الدقيق","important":true,"createdBy":"","group":2},
  {"id":"o5","time":"09:45","title":"Envol d''Istanbul (Sabiha Gökçen) vers Alger (Pegasus Airlines)","titleAr":"الإقلاع من إسطنبول (صبيحة غوكتشن) نحو الجزائر (بيغاسوس)","important":true,"createdBy":"","group":2},
  {"id":"o6","time":"11:35","title":"Arrivée à Alger (heure locale)","titleAr":"الوصول إلى الجزائر (التوقيت المحلي)","important":false,"createdBy":"","group":2}
]'::jsonb)
on conflict (date) do update
  set items = excluded.items, updated_at = now()
  where jsonb_array_length(s.items) > 0
    and not exists (select 1 from jsonb_array_elements(s.items) e where e ->> 'id' !~ '^o[0-9]+$');

-- ---------- guide pratique ----------
insert into public.places (id, category, name, description, address, phone, lat, lng) values
('e1', 'emergency', 'Urgences (112)', 'Numéro unique en Turquie : police, ambulance et pompiers.', null, '112', null, null),
('e2', 'emergency', 'Police touristique (Sultanahmet)', 'Poste réservé aux touristes, près de Sainte-Sophie. En cas de vol ou de problème : demandez de l''aide ici ou appelez le 112.', 'Sultanahmet, Fatih, Istanbul', null, 41.00774, 28.97658),
('g1', 'group', 'Notre hôtel : Hampton by Hilton Istanbul Sirkeci', 'Petit-déjeuner inclus chaque matin. À 3 min à pied du Bazar aux épices et à 4 min de la gare de Sirkeci.', 'Hobyar Mah., Hocamkasım Köprü Sk. No:5, 34112 Fatih/İstanbul', null, 41.01358, 28.97377),
('g2', 'group', 'Réunion Ultimate (formation)', 'Vendredi 6 novembre, le matin (début entre 9h et 10h), dans la salle de formation de l''hôtel, jusqu''à 12:30 environ.', 'Hampton by Hilton Istanbul Sirkeci', null, 41.01358, 28.97377),
('g3', 'group', 'Balade du Bosphore (départ d''Eminönü)', 'Vendredi 6 novembre : on sort de l''hôtel à 13:00, la balade part d''Eminönü et se termine vers 17:00.', 'Eminönü, Fatih, Istanbul', null, 41.0183, 28.9731),
('g4', 'group', 'Visite autour de la mosquée Sultan Ahmed (Mosquée Bleue)', 'Samedi 7 novembre. Tenue modeste, foulard pour les femmes, chaussures à retirer à l''entrée. L''heure du départ est donnée par le staff.', 'Sultanahmet Meydanı, Fatih, Istanbul', null, 41.00538, 28.97685),
('i1', 'info', 'Petit-déjeuner inclus', 'Tous les matins à l''hôtel.', null, null, null, null),
('i2', 'info', 'Règles du groupe', 'En groupe de 3 minimum hors zone verte · retour à l''hôtel avant 22h00 · téléphone chargé · position en direct dans le groupe WhatsApp.', null, null, null, null),
('i3', 'info', 'Heure', 'Istanbul = Alger + 2 h.', null, null, null, null),
('i4', 'info', 'Monnaie', 'Livre turque (TRY). Quand le terminal de carte propose de payer en euros, choisissez toujours la livre turque.', null, null, null, null),
('i5', 'info', 'Prises électriques', 'Type C/F, 230 V : comme en Algérie.', null, null, null, null),
('t1', 'tool', 'BiTaksi', 'Application de taxi. Compteur allumé et adresse de l''hôtel en turc : « Lütfen beni bu otele götürün ».', null, null, null, null),
('t2', 'tool', 'Istanbulkart', 'Une seule carte pour le tram, le ferry et le métro, à recharger aux bornes automatiques.', null, null, null, null)
on conflict (id) do nothing;

-- Le guide en arabe (affiché quand l'appli est en arabe). Rempli seulement là où l'arabe est encore vide : vos modifications restent.
update public.places p set name_ar = v.name_ar, description_ar = v.description_ar
from (values
  ('e1', 'الطوارئ (112)', 'رقم موحد في تركيا: الشرطة والإسعاف والإطفاء.'),
  ('e2', 'الشرطة السياحية (السلطان أحمد)', 'مركز مخصص للسياح قرب آيا صوفيا. في حال السرقة أو أي مشكلة: اطلبوا المساعدة هناك أو اتصلوا بالرقم 112.'),
  ('g1', 'فندقنا: Hampton by Hilton Istanbul Sirkeci', 'الفطور مشمول كل صباح. على بعد 3 دقائق مشياً من سوق التوابل و4 دقائق من محطة سيركجي.'),
  ('g2', 'اجتماع Ultimate (التكوين)', 'الجمعة 6 نوفمبر، صباحاً (البداية بين التاسعة والعاشرة)، في قاعة التكوين بالفندق، إلى حوالي 12:30.'),
  ('g3', 'جولة البوسفور (الانطلاق من إمينونو)', 'الجمعة 6 نوفمبر: نخرج من الفندق على الساعة 13:00، وتنطلق الجولة من إمينونو وتنتهي حوالي 17:00.'),
  ('g4', 'جولة حول مسجد السلطان أحمد (المسجد الأزرق)', 'السبت 7 نوفمبر. لباس محتشم، وغطاء الرأس للسيدات، وخلع الأحذية عند الدخول. يعلمكم الفريق بوقت الانطلاق.'),
  ('i1', 'الفطور مشمول', 'كل صباح في الفندق.'),
  ('i2', 'قواعد المجموعة', 'ثلاثة أشخاص على الأقل خارج المنطقة الخضراء · العودة إلى الفندق قبل الساعة 22:00 · هاتف مشحون · مشاركة الموقع المباشر في مجموعة واتساب.'),
  ('i3', 'التوقيت', 'إسطنبول = الجزائر + ساعتان.'),
  ('i4', 'العملة', 'الليرة التركية (TRY). عندما يقترح جهاز الدفع بالبطاقة الدفع باليورو، اختاروا دائماً الليرة التركية.'),
  ('i5', 'المقابس الكهربائية', 'النوع C/F، 230 فولت: مثل الجزائر.'),
  ('t1', 'BiTaksi', 'تطبيق سيارات الأجرة. اطلبوا تشغيل العدّاد وأروا السائق عنوان الفندق بالتركية: « Lütfen beni bu otele götürün ».'),
  ('t2', 'Istanbulkart', 'بطاقة واحدة للترامواي والعبّارة والمترو، تُشحن من الأجهزة الآلية.')
) as v(id, name_ar, description_ar)
where p.id = v.id and p.name_ar = '' and p.description_ar = '';
update public.trip set name_ar = 'رحلة إسطنبول 2026' where id = 'current' and name_ar = '';

-- ---------- vos codes ----------
select code, value from (
  select 1 as o, 'Code consultants (à donner aux participants)' as code, value from public.config where key = 'invite_code'
  union all
  select 2, 'Code staff (réservé à l''équipe)', value from public.config where key = 'staff_code'
  union all
  select 3, 'Participants dont le compte est prêt',
         count(*)::text || ' (groupe 1 : ' || count(*) filter (where group_id = 1)::text
                        || ', groupe 2 : ' || count(*) filter (where group_id = 2)::text || ')'
  from public.roster where role = 'consultant'
) t
order by o;
