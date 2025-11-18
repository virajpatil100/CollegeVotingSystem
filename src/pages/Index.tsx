import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { VotingCard } from "@/components/voting/VotingCard";
import { ResultsCard } from "@/components/results/ResultsCard";
import { CreateElectionDialog } from "@/components/admin/CreateElectionDialog";
import { MyElectionsSection } from "@/components/host/MyElectionsSection";
import { LogOut, Shield, Plus, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Profile {
  id: string;
  zprn_id: string;
  name: string;
}

export default function Index() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [elections, setElections] = useState<any[]>([]);
  const [myElections, setMyElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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
      
      // Check admin role using secure function
      const { data: adminStatus } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      setIsAdmin(!!adminStatus);
      
      await loadElections(profileData);
      await loadMyElections(profileData);
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
          if (profileData) {
            loadElections(profileData);
            loadMyElections(profileData);
          }
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
        candidates (*)
      `)
      .in("id", electionIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (electionsData) {
      const electionsWithVoteStatus = await Promise.all(
        electionsData.map(async (election) => {
          // Check if user has voted using secure function
          const { data: hasVoted } = await supabase.rpc("has_user_voted", {
            election_uuid: election.id,
          });

          // Get the candidate they voted for (if any) using secure function
          const { data: votedCandidateId } = await supabase.rpc("get_user_vote", {
            election_uuid: election.id,
          });

          return {
            ...election,
            hasVoted: !!hasVoted,
            votedCandidateId,
          };
        })
      );
      setElections(electionsWithVoteStatus);
    }
  };

  const loadMyElections = async (userProfile: Profile) => {
    const { data: myElectionsData } = await supabase
      .from("elections")
      .select(`
        *,
        candidates (*)
      `)
      .eq("created_by", userProfile.id)
      .order("created_at", { ascending: false });

    if (myElectionsData) {
      const electionsWithData = await Promise.all(
        myElectionsData.map(async (election) => {
          // Get voter turnout using secure function
          const { data: voterStatuses } = await supabase.rpc("get_voter_turnout", {
            election_uuid: election.id,
          });

          // Get aggregated results using secure function
          const { data: results } = await supabase.rpc("get_election_results", {
            election_uuid: election.id,
          });

          // Map results to candidates with vote counts
          const candidatesWithVotes = election.candidates.map((candidate: any) => {
            const voteData = results?.find((r: any) => r.candidate_id === candidate.id);
            return {
              ...candidate,
              vote_count: voteData?.vote_count || 0,
            };
          });

          return {
            ...election,
            candidates: candidatesWithVotes,
            voterStatuses: voterStatuses || [],
          };
        })
      );

      setMyElections(electionsWithData);
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
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate("/candidate-results")}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Candidate Results
            </Button>
            {isAdmin && (
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

        <Tabs defaultValue="vote" className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3">
            <TabsTrigger value="vote">Cast Vote</TabsTrigger>
            <TabsTrigger value="results">View Results</TabsTrigger>
            <TabsTrigger value="my-elections">My Elections</TabsTrigger>
          </TabsList>
          <TabsContent value="vote" className="mt-6">
            {elections.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No active elections available for you at the moment.
                </p>
              </div>
            ) : (
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
            )}
          </TabsContent>
          <TabsContent value="results" className="mt-6">
            {elections.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No active elections available for you at the moment.
                </p>
              </div>
            ) : (
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
            )}
          </TabsContent>
          
          <TabsContent value="my-elections" className="mt-6">
            <div className="mb-6 flex justify-end">
              {profile && (
                <CreateElectionDialog 
                  userId={profile.id} 
                  onElectionCreated={() => {
                    loadElections(profile);
                    loadMyElections(profile);
                  }} 
                />
              )}
            </div>
            <MyElectionsSection 
              elections={myElections}
              onElectionDeleted={() => profile && loadMyElections(profile)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
