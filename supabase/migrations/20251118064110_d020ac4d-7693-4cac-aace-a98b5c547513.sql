-- Add unique_id column to candidates table
ALTER TABLE public.candidates ADD COLUMN unique_id TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_candidates_unique_id ON public.candidates(unique_id);

-- Add policy for candidates to view their own results using unique_id
CREATE POLICY "Candidates can view their own results with unique_id"
ON public.candidates
FOR SELECT
USING (unique_id IS NOT NULL);