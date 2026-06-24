-- Enable Row Level Security on stl_removal_decisions table
ALTER TABLE public.stl_removal_decisions ENABLE ROW LEVEL SECURITY;

-- Create admin-only access policy
CREATE POLICY "Admins have full access on stl_removal_decisions"
  ON public.stl_removal_decisions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
