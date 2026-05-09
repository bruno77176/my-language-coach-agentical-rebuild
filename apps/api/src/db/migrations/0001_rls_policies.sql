-- Enable RLS on every user-owned table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- profiles: select + update own row
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);
-- INSERT into profiles is restricted to the complete_onboarding RPC (Task below).

-- conversations / messages / vocab_items / streak_days / push_tokens: full CRUD on own rows
CREATE POLICY "conversations_all_own" ON conversations
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "messages_all_own" ON messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "vocab_items_all_own" ON vocab_items
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "streak_days_all_own" ON streak_days
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "push_tokens_all_own" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- topics: select built-in or own; insert/delete own
CREATE POLICY "topics_select_built_in_or_own" ON topics
  FOR SELECT USING (is_built_in OR auth.uid() = user_id);
CREATE POLICY "topics_insert_own" ON topics
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_built_in = false);
CREATE POLICY "topics_delete_own" ON topics
  FOR DELETE USING (auth.uid() = user_id AND is_built_in = false);

-- entitlements: select own only (writes via service role from backend)
CREATE POLICY "entitlements_select_own" ON entitlements
  FOR SELECT USING (auth.uid() = user_id);

-- waitlist: insert allowed to anyone with valid auth (or anon, see WITH CHECK)
CREATE POLICY "waitlist_insert_any" ON waitlist
  FOR INSERT WITH CHECK (true);

-- Check constraints
ALTER TABLE push_tokens
  ADD CONSTRAINT push_tokens_platform_check CHECK (platform IN ('ios', 'android'));

ALTER TABLE entitlements
  ADD CONSTRAINT entitlements_plan_check CHECK (plan IN ('free', 'pro'));
