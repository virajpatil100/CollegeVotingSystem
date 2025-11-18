import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface Candidate {
  id: string;
  name: string;
  vote_count: number;
}

interface ResultsCardProps {
  election: {
    id: string;
    title: string;
  };
  candidates: Candidate[];
  totalVotes: number;
}

export const ResultsCard = ({ election, candidates, totalVotes }: ResultsCardProps) => {
  const sortedCandidates = [...candidates].sort((a, b) => b.vote_count - a.vote_count);
  const winningVotes = sortedCandidates[0]?.vote_count || 0;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">{election.title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Total Votes: {totalVotes}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedCandidates.map((candidate, index) => {
          const percentage = totalVotes > 0 ? (candidate.vote_count / totalVotes) * 100 : 0;
          const isWinning = candidate.vote_count === winningVotes && totalVotes > 0;
          
          return (
            <div key={candidate.id} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{candidate.name}</span>
                  {isWinning && (
                    <Badge variant="default" className="bg-success">
                      Leading
                    </Badge>
                  )}
                </div>
                <span className="text-sm font-semibold">
                  {percentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={percentage} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {candidate.vote_count} {candidate.vote_count === 1 ? "vote" : "votes"}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
