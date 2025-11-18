import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BarChart3 } from "lucide-react";

export default function CandidateResults() {
  const [uniqueId, setUniqueId] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!uniqueId.trim()) {
      toast({
        title: "Error",
        description: "Please enter your unique ID",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch candidate details with unique_id
      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .select(`
          *,
          election:elections(*)
        `)
        .eq("unique_id", uniqueId.trim())
        .maybeSingle();

      if (candidateError) throw candidateError;

      if (!candidate) {
        toast({
          title: "Not Found",
          description: "No candidate found with this ID",
          variant: "destructive",
        });
        setResults(null);
        return;
      }

      // Fetch votes for this candidate
      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select("*")
        .eq("candidate_id", candidate.id);

      if (votesError) throw votesError;

      // Fetch all votes for the election to calculate percentage
      const { data: allVotes, error: allVotesError } = await supabase
        .from("votes")
        .select("*")
        .eq("election_id", candidate.election_id);

      if (allVotesError) throw allVotesError;

      setResults({
        candidate,
        voteCount: votes?.length || 0,
        totalVotes: allVotes?.length || 0,
        percentage: allVotes?.length > 0 
          ? ((votes?.length || 0) / allVotes.length * 100).toFixed(1)
          : "0.0",
      });

      toast({
        title: "Success",
        description: "Results loaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Candidate Results</h1>
          <p className="text-muted-foreground">
            Enter your unique candidate ID to view your vote count
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Check Your Results
            </CardTitle>
            <CardDescription>
              Use the unique ID provided when the election was created
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uniqueId">Unique Candidate ID</Label>
              <Input
                id="uniqueId"
                placeholder="Enter your unique ID"
                value={uniqueId}
                onChange={(e) => setUniqueId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} className="w-full">
              {loading ? "Loading..." : "View Results"}
            </Button>
          </CardContent>
        </Card>

        {results && (
          <Card className="mt-6 shadow-lg">
            <CardHeader>
              <CardTitle>{results.candidate.name}</CardTitle>
              <CardDescription>
                {results.candidate.election.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.candidate.description && (
                <p className="text-muted-foreground">{results.candidate.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-primary/5 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Your Votes</p>
                  <p className="text-3xl font-bold text-primary">{results.voteCount}</p>
                </div>
                <div className="p-4 bg-secondary/50 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Vote Share</p>
                  <p className="text-3xl font-bold">{results.percentage}%</p>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Total votes in this election: <span className="font-semibold">{results.totalVotes}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
