-- Update elections policies to allow students to create elections
DROP POLICY IF EXISTS "Admins can manage elections" ON public.elections;

CREATE POLICY "Users can create elections"
  ON public.elections FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own elections"
  ON public.elections FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own elections"
  ON public.elections FOR DELETE
  USING (auth.uid() = created_by);

-- Update candidates policies to allow creators to manage candidates
DROP POLICY IF EXISTS "Admins can manage candidates" ON public.candidates;

CREATE POLICY "Election creators can insert candidates"
  ON public.candidates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elections
      WHERE elections.id = candidates.election_id
      AND elections.created_by = auth.uid()
    )
  );

CREATE POLICY "Election creators can update candidates"
  ON public.candidates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.elections
      WHERE elections.id = candidates.election_id
      AND elections.created_by = auth.uid()
    )
  );

CREATE POLICY "Election creators can delete candidates"
  ON public.candidates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.elections
      WHERE elections.id = candidates.election_id
      AND elections.created_by = auth.uid()
    )
  );

-- Update election_voters policies to allow creators to manage voters
DROP POLICY IF EXISTS "Admins can manage election voters" ON public.election_voters;

CREATE POLICY "Election creators can insert voters"
  ON public.election_voters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elections
      WHERE elections.id = election_voters.election_id
      AND elections.created_by = auth.uid()
    )
  );

CREATE POLICY "Election creators can update voters"
  ON public.election_voters FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.elections
      WHERE elections.id = election_voters.election_id
      AND elections.created_by = auth.uid()
    )
  );

CREATE POLICY "Election creators can delete voters"
  ON public.election_voters FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.elections
      WHERE elections.id = election_voters.election_id
      AND elections.created_by = auth.uid()
    )
  );

CREATE POLICY "Election creators can view voters"
  ON public.election_voters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.elections
      WHERE elections.id = election_voters.election_id
      AND elections.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.zprn_id = election_voters.zprn_id
    )
  );