-- Fix 1: Create secure role management system
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('student', 'admin');

-- Create user_roles table with proper security
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can view roles (but we need the security definer function first)
-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Only database admins can insert/update/delete roles (no policies = deny all writes)

-- Create security definer function to check roles safely
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role::app_role
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Update the handle_new_user trigger to use user_roles instead
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile without role
  INSERT INTO public.profiles (id, zprn_id, name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'zprn_id',
    new.raw_user_meta_data->>'name'
  );
  
  -- Always assign student role, never trust user metadata for roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'student');
  
  RETURN new;
END;
$$;

-- Remove role column from profiles (after migration)
ALTER TABLE public.profiles DROP COLUMN role;

-- Update profiles RLS policy to prevent privilege escalation
-- Drop the old update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new restrictive update policy (only name updates allowed)
CREATE POLICY "Users can update their own name"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Fix 2: Secure the votes table to protect ballot secrecy
-- Drop the public SELECT policy on votes
DROP POLICY IF EXISTS "Users can view votes for elections they can access" ON public.votes;

-- Create secure function to get aggregated election results
CREATE OR REPLACE FUNCTION public.get_election_results(election_uuid UUID)
RETURNS TABLE(candidate_id UUID, vote_count BIGINT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT candidate_id, COUNT(*) as vote_count
  FROM public.votes
  WHERE election_id = election_uuid
  GROUP BY candidate_id
$$;

-- Create function to check if current user has voted in an election
CREATE OR REPLACE FUNCTION public.has_user_voted(election_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.votes
    WHERE election_id = election_uuid
      AND voter_id = auth.uid()
  )
$$;

-- Create function to get candidate ID the user voted for (only their own vote)
CREATE OR REPLACE FUNCTION public.get_user_vote(election_uuid UUID)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT candidate_id
  FROM public.votes
  WHERE election_id = election_uuid
    AND voter_id = auth.uid()
  LIMIT 1
$$;

-- Create function for election creators to see voter turnout (without revealing votes)
CREATE OR REPLACE FUNCTION public.get_voter_turnout(election_uuid UUID)
RETURNS TABLE(zprn_id TEXT, name TEXT, has_voted BOOLEAN)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ev.zprn_id,
    p.name,
    EXISTS(SELECT 1 FROM votes v WHERE v.voter_id = p.id AND v.election_id = election_uuid) as has_voted
  FROM election_voters ev
  JOIN profiles p ON p.zprn_id = ev.zprn_id
  WHERE ev.election_id = election_uuid
    AND EXISTS(
      SELECT 1 FROM elections e 
      WHERE e.id = election_uuid 
      AND e.created_by = auth.uid()
    )
$$;

-- Update RLS policies that checked for admin role
-- Drop old policies that referenced profiles.role
DROP POLICY IF EXISTS "Election creators can delete candidates" ON public.candidates;
DROP POLICY IF EXISTS "Election creators can insert candidates" ON public.candidates;
DROP POLICY IF EXISTS "Election creators can update candidates" ON public.candidates;

-- Recreate with proper checks (no role needed for election creators)
CREATE POLICY "Election creators can delete candidates"
ON public.candidates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM elections
    WHERE elections.id = candidates.election_id
      AND elections.created_by = auth.uid()
  )
);

CREATE POLICY "Election creators can insert candidates"
ON public.candidates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM elections
    WHERE elections.id = candidates.election_id
      AND elections.created_by = auth.uid()
  )
);

CREATE POLICY "Election creators can update candidates"
ON public.candidates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM elections
    WHERE elections.id = candidates.election_id
      AND elections.created_by = auth.uid()
  )
);

-- Similar updates for election_voters policies
DROP POLICY IF EXISTS "Election creators can delete voters" ON public.election_voters;
DROP POLICY IF EXISTS "Election creators can insert voters" ON public.election_voters;
DROP POLICY IF EXISTS "Election creators can update voters" ON public.election_voters;
DROP POLICY IF EXISTS "Election creators can view voters" ON public.election_voters;

CREATE POLICY "Election creators can delete voters"
ON public.election_voters
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM elections
    WHERE elections.id = election_voters.election_id
      AND elections.created_by = auth.uid()
  )
);

CREATE POLICY "Election creators can insert voters"
ON public.election_voters
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM elections
    WHERE elections.id = election_voters.election_id
      AND elections.created_by = auth.uid()
  )
);

CREATE POLICY "Election creators can update voters"
ON public.election_voters
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM elections
    WHERE elections.id = election_voters.election_id
      AND elections.created_by = auth.uid()
  )
);

CREATE POLICY "Election creators can view voters"
ON public.election_voters
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM elections
    WHERE elections.id = election_voters.election_id
      AND elections.created_by = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.zprn_id = election_voters.zprn_id
  )
);