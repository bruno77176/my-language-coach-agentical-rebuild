-- Initial built-in topics catalog. Labels are jsonb keyed by language code.
INSERT INTO topics (slug, label, system_prompt_addendum, is_built_in) VALUES
  ('free-conversation',
   '{"en":"Free conversation","fr":"Conversation libre","de":"Freies Gespräch","es":"Conversación libre","it":"Conversazione libera","pt":"Conversa livre","tr":"Serbest sohbet","sv":"Fritt samtal","da":"Fri samtale","ru":"Свободная беседа","ro":"Conversație liberă","hu":"Szabad beszélgetés"}'::jsonb,
   '',
   true),
  ('ordering-coffee',
   '{"en":"Ordering coffee","fr":"Commander un café","de":"Kaffee bestellen","es":"Pedir un café","it":"Ordinare un caffè","pt":"Pedir um café","tr":"Kahve ısmarlamak","sv":"Beställa kaffe","da":"Bestille kaffe","ru":"Заказать кофе","ro":"A comanda o cafea","hu":"Kávét rendelni"}'::jsonb,
   'Roleplay: you are a barista at a small café. The user is a customer ordering coffee and pastries.',
   true),
  ('job-interview',
   '{"en":"Job interview","fr":"Entretien d''embauche","de":"Vorstellungsgespräch","es":"Entrevista de trabajo","it":"Colloquio di lavoro","pt":"Entrevista de emprego","tr":"İş görüşmesi","sv":"Anställningsintervju","da":"Jobsamtale","ru":"Собеседование","ro":"Interviu de angajare","hu":"Állásinterjú"}'::jsonb,
   'Roleplay: you are a hiring manager interviewing the user for a junior role they applied for.',
   true);
