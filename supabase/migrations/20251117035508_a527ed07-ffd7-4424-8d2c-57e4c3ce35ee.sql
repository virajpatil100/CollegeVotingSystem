-- Create profiles table with ZPRN ID
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  zprn_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create elections table
CREATE TABLE public.elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on elections
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;

-- Elections policies
CREATE POLICY "Anyone can view active elections"
  ON public.elections FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage elections"
  ON public.elections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on candidates
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Candidates policies
CREATE POLICY "Anyone can view candidates"
  ON public.candidates FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage candidates"
  ON public.candidates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create election_voters table (whitelist)
CREATE TABLE public.election_voters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
  zprn_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(election_id, zprn_id)
);

-- Enable RLS on election_voters
ALTER TABLE public.election_voters ENABLE ROW LEVEL SECURITY;

-- Election voters policies
CREATE POLICY "Admins can manage election voters"
  ON public.election_voters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view if they are whitelisted"
  ON public.election_voters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.zprn_id = election_voters.zprn_id
    )
  );

-- Create votes table
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  voter_id UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(election_id, voter_id)
);

-- Enable RLS on votes
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Votes policies
CREATE POLICY "Users can view votes for elections they can access"
  ON public.votes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own vote if whitelisted"
  ON public.votes FOR INSERT
  WITH CHECK (
    auth.uid() = voter_id AND
    EXISTS (
      SELECT 1 FROM public.election_voters ev
      JOIN public.profiles p ON p.zprn_id = ev.zprn_id
      WHERE ev.election_id = votes.election_id
      AND p.id = auth.uid()
    )
  );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, zprn_id, name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'zprn_id',
    new.raw_user_meta_data->>'name',
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  );
  RETURN new;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for votes table
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;