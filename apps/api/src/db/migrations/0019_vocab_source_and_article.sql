-- Word-deck enrichment (BRU-11 + BRU-31):
--   source_sentence — the phrase the word was first saved from, so review can
--                     happen in context instead of as an isolated word.
--   article         — the definite article for gendered nouns (der/die/das,
--                     le/la, el/la, il/lo/la, …) so a German "Tisch" is learnt
--                     as "der Tisch". Null for non-nouns / article-less langs.
-- Additive + idempotent; the existing vocab_items_all_own RLS policy covers it.
ALTER TABLE vocab_items
  ADD COLUMN IF NOT EXISTS source_sentence text,
  ADD COLUMN IF NOT EXISTS article text;
