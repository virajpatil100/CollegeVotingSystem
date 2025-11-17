import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  description: string | null;
}

interface VotingCardProps {
  election: {
    id: string;
    title: string;
    description: string | null;
  };
  candidates: Candidate[];
  hasVoted: boolean;
  votedCandidateId?: string;
  onVoteSuccess: () => void;
  userId: string;
}

export const VotingCard = ({ 
  election, 
  candidates, 
  hasVoted, 
  votedCandidateId,
  onVoteSuccess,
  userId 
}: VotingCardProps) => {
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleVote = async () => {
    if (!selectedCandidate) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("votes")
        .insert({
          election_id: election.id,
          candidate_id: selectedCandidate,
          voter_id: userId,
        });

      if (error) {
        if (error.message.includes("duplicate")) {
          throw new Error("You have already voted in this election.");
        }
        throw error;
      }

      toast({
        title: "Vote submitted!",
        description: "Your vote has been recorded successfully.",
      });
      onVoteSuccess();
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
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{election.title}</CardTitle>
            {election.description && (
              <CardDescription className="mt-1">{election.description}</CardDescription>
            )}
          </div>
          {hasVoted && (
            <Badge variant="secondary" className="bg-success text-success-foreground">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Voted
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidates.map((candidate) => (
          <button
            key={candidate.id}
            onClick={() => !hasVoted && setSelectedCandidate(candidate.id)}
            disabled={hasVoted}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              hasVoted
                ? votedCandidateId === candidate.id
                  ? "border-success bg-success/10"
                  : "border-border bg-muted/50 opacity-60"
                : selectedCandidate === candidate.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 bg-vote-card hover:bg-vote-card-hover"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold">{candidate.name}</h4>
                {candidate.description && (
                  <p className="text-sm text-muted-foreground mt-1">{candidate.description}</p>
                )}
              </div>
              {selectedCandidate === candidate.id && !hasVoted && (
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 ml-2" />
              )}
              {hasVoted && votedCandidateId === candidate.id && (
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 ml-2" />
              )}
            </div>
          </button>
        ))}
        
        {!hasVoted && (
          <Button
            onClick={handleVote}
            disabled={!selectedCandidate || loading}
            className="w-full mt-4"
          >
            {loading ? "Submitting..." : "Submit Vote"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
