-- Rupxa Migration: Group Expenses & Multi-Expense Split Management
-- Enables multiple expenses per split group, custom/equal splits, categories, and real-time synchronization

CREATE TABLE IF NOT EXISTS public.split_group_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_group_id UUID NOT NULL REFERENCES public.split_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  paid_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  split_type TEXT NOT NULL DEFAULT 'equal',
  shares JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_split_group_expenses_group_id ON public.split_group_expenses(split_group_id);
CREATE INDEX IF NOT EXISTS idx_split_group_expenses_paid_by ON public.split_group_expenses(paid_by_user_id);
CREATE INDEX IF NOT EXISTS idx_split_group_expenses_created_at ON public.split_group_expenses(created_at DESC);

-- Enable RLS
ALTER TABLE public.split_group_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Members of the group can view, insert, update, and delete group expenses
CREATE POLICY "Group members can view group expenses"
  ON public.split_group_expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.split_members
      WHERE split_members.split_group_id = split_group_expenses.split_group_id
      AND split_members.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.split_groups
      WHERE split_groups.id = split_group_expenses.split_group_id
      AND split_groups.created_by = auth.uid()
    )
  );

CREATE POLICY "Group members can insert group expenses"
  ON public.split_group_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND (
      EXISTS (
        SELECT 1 FROM public.split_members
        WHERE split_members.split_group_id = split_group_expenses.split_group_id
        AND split_members.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.split_groups
        WHERE split_groups.id = split_group_expenses.split_group_id
        AND split_groups.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Group members can update group expenses"
  ON public.split_group_expenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.split_members
      WHERE split_members.split_group_id = split_group_expenses.split_group_id
      AND split_members.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.split_groups
      WHERE split_groups.id = split_group_expenses.split_group_id
      AND split_groups.created_by = auth.uid()
    )
  );

CREATE POLICY "Group members can delete group expenses"
  ON public.split_group_expenses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.split_members
      WHERE split_members.split_group_id = split_group_expenses.split_group_id
      AND split_members.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.split_groups
      WHERE split_groups.id = split_group_expenses.split_group_id
      AND split_groups.created_by = auth.uid()
    )
  );

-- Add to Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.split_group_expenses;
