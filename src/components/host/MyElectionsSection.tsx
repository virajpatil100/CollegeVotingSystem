import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VoterTurnoutCard } from "@/components/admin/VoterTurnoutCard";
import { ResultsCard } from "@/components/results/ResultsCard";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MyElectionsSectionProps {
  elections: any[];
  onElectionDeleted: () => void;
}

export const MyElectionsSection = ({ elections, onElectionDeleted }: MyElectionsSectionProps) => {
  const { toast } = useToast();

  const handleDeleteElection = async (electionId: string) => {
    if (!confirm("Are you sure you want to delete this election? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("elections")
        .delete()
        .eq("id", electionId);

      if (error) throw error;

      toast({
        title: "Election deleted",
        description: "The election has been deleted successfully.",
      });
      onElectionDeleted();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (elections.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          You haven't created any elections yet. Click "Host Election" to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {elections.map((election) => {
        const candidatesWithVotes = election.candidates.map((candidate: any) => ({
          ...candidate,
          voteCount: election.votes.filter((v: any) => v.candidate_id === candidate.id).length,
        }));

        return (
          <Card key={election.id} className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">{election.title}</CardTitle>
                  {election.description && (
                    <p className="text-muted-foreground mt-1">{election.description}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Badge variant={election.is_active ? "default" : "secondary"}>
                      {election.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">
                      {election.votes.length} votes
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteElection(election.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <ResultsCard
                  election={election}
                  candidates={candidatesWithVotes}
                  totalVotes={election.votes.length}
                />
                <VoterTurnoutCard
                  election={election}
                  voters={election.voterStatuses}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
