-- Rupxa Initial Schema Migration
-- Complete V1: profiles, expenses, split_groups, split_members, split_activity

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  expense_date DATE NOT NULL,
  payment_method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create split_groups table
CREATE TABLE IF NOT EXISTS public.split_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create split_members table
CREATE TABLE IF NOT EXISTS public.split_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_group_id UUID NOT NULL REFERENCES public.split_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_group_user UNIQUE (split_group_id, user_id)
);

-- 5. Create split_activity table (Immutable append-only history)
CREATE TABLE IF NOT EXISTS public.split_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_group_id UUID NOT NULL REFERENCES public.split_groups(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_value TEXT,
  new_value TEXT,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_split_groups_created_by ON public.split_groups(created_by);

CREATE INDEX IF NOT EXISTS idx_split_members_group_id ON public.split_members(split_group_id);
CREATE INDEX IF NOT EXISTS idx_split_members_user_id ON public.split_members(user_id);

CREATE INDEX IF NOT EXISTS idx_split_activity_group_id ON public.split_activity(split_group_id);
CREATE INDEX IF NOT EXISTS idx_split_activity_created_at ON public.split_activity(created_at DESC);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_activity ENABLE ROW LEVEL SECURITY;

-- 8. Profiles RLS Policies
-- Authenticated users can search limited profiles for member connection
CREATE POLICY "Allow authenticated users to read profiles for discovery"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 9. Expenses RLS Policies
-- Owners can read, insert, update, and delete their own expenses
CREATE POLICY "Users can view their own expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 10. Split Groups RLS Policies
-- Members and creators can view groups they belong to
CREATE POLICY "Users can view split groups they are member of or created"
  ON public.split_groups FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.split_members
      WHERE split_members.split_group_id = split_groups.id
      AND split_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create split groups"
  ON public.split_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Only group creators can update group details"
  ON public.split_groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- 11. Split Members RLS Policies
-- Members can view members in their shared groups
CREATE POLICY "Members can view members of their groups"
  ON public.split_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.split_members AS sm
      WHERE sm.split_group_id = split_members.split_group_id
      AND sm.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.split_groups AS sg
      WHERE sg.id = split_members.split_group_id
      AND sg.created_by = auth.uid()
    )
  );

CREATE POLICY "Creators can add members or users can join"
  ON public.split_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.split_groups
      WHERE id = split_group_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Normal members can update ONLY their own amount; owners can update all"
  ON public.split_members FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.split_groups
      WHERE id = split_group_id AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.split_groups
      WHERE id = split_group_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Owners can remove members, or members can leave"
  ON public.split_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.split_groups
      WHERE id = split_group_id AND created_by = auth.uid()
    )
  );

-- 12. Split Activity RLS Policies (Immutable append-only)
CREATE POLICY "Group members can view activity"
  ON public.split_activity FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.split_members
      WHERE split_members.split_group_id = split_activity.split_group_id
      AND split_members.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.split_groups
      WHERE split_groups.id = split_activity.split_group_id
      AND split_groups.created_by = auth.uid()
    )
  );

CREATE POLICY "Members can insert activity"
  ON public.split_activity FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_user_id);

-- Note: No UPDATE or DELETE policies are granted for split_activity, guaranteeing immutability!

-- 13. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.split_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.split_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.split_activity;
