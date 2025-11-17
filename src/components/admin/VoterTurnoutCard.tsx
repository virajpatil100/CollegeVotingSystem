import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface VoterStatus {
  zprn_id: string;
  name?: string;
  has_voted: boolean;
}

interface VoterTurnoutCardProps {
  election: {
    id: string;
    title: string;
  };
  voters: VoterStatus[];
}

export const VoterTurnoutCard = ({ election, voters }: VoterTurnoutCardProps) => {
  const votedCount = voters.filter((v) => v.has_voted).length;
  const totalVoters = voters.length;
  const turnoutPercentage = totalVoters > 0 ? (votedCount / totalVoters) * 100 : 0;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">{election.title} - Voter Turnout</CardTitle>
        <div className="space-y-2 mt-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Turnout</span>
            <span className="font-semibold">
              {votedCount} / {totalVoters} ({turnoutPercentage.toFixed(1)}%)
            </span>
          </div>
          <Progress value={turnoutPercentage} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid gap-2">
          {voters.map((voter) => (
            <div
              key={voter.zprn_id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                {voter.has_voted ? (
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium">{voter.zprn_id}</p>
                  {voter.name && (
                    <p className="text-sm text-muted-foreground">{voter.name}</p>
                  )}
                </div>
              </div>
              <Badge variant={voter.has_voted ? "default" : "secondary"}>
                {voter.has_voted ? "Voted" : "Pending"}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
