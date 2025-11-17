import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { VotingCard } from "@/components/voting/VotingCard";
import { ResultsCard } from "@/components/results/ResultsCard";
import { LogOut, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Profile {
  id: string;
  role: string;
  zprn_id: string;
  name: string;
}

export default function Index() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      await loadElections(profileData);
    }
    
    setLoading(false);

    // Subscribe to real-time updates
    const channel = supabase
      .channel("votes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
        },
        () => {
          if (profileData) loadElections(profileData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadElections = async (userProfile: Profile) => {
    // Get elections where user is whitelisted
    const { data: whitelistedElections } = await supabase
      .from("election_voters")
      .select("election_id")
      .eq("zprn_id", userProfile.zprn_id);

    if (!whitelistedElections) return;

    const electionIds = whitelistedElections.map((e) => e.election_id);

    if (electionIds.length === 0) {
      setElections([]);
      return;
    }

    const { data: electionsData } = await supabase
      .from("elections")
      .select(`
        *,
        candidates (*),
        votes (*)
      `)
      .in("id", electionIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (electionsData) {
      const electionsWithVoteStatus = electionsData.map((election) => {
        const userVote = election.votes.find((v: any) => v.voter_id === userProfile.id);
        return {
          ...election,
          hasVoted: !!userVote,
          votedCandidateId: userVote?.candidate_id,
        };
      });
      setElections(electionsWithVoteStatus);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Digital Voting System</h1>
            {profile && (
              <p className="text-muted-foreground mt-1">
                Welcome, {profile.name} ({profile.zprn_id})
              </p>
            )}
          </div>
          <div className="flex gap-3">
            {profile?.role === "admin" && (
              <Button variant="outline" onClick={() => navigate("/admin")}>
                <Shield className="w-4 h-4 mr-2" />
                Admin Panel
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {elections.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No active elections available for you at the moment.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="vote" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="vote">Cast Vote</TabsTrigger>
              <TabsTrigger value="results">View Results</TabsTrigger>
            </TabsList>
            <TabsContent value="vote" className="mt-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {elections.map((election) => (
                  <VotingCard
                    key={election.id}
                    election={election}
                    candidates={election.candidates}
                    hasVoted={election.hasVoted}
                    votedCandidateId={election.votedCandidateId}
                    onVoteSuccess={() => profile && loadElections(profile)}
                    userId={profile!.id}
                  />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="results" className="mt-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {elections.map((election) => {
                  const candidatesWithVotes = election.candidates.map((candidate: any) => ({
                    ...candidate,
                    voteCount: election.votes.filter((v: any) => v.candidate_id === candidate.id).length,
                  }));

                  return (
                    <ResultsCard
                      key={election.id}
                      election={election}
                      candidates={candidatesWithVotes}
                      totalVotes={election.votes.length}
                    />
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
