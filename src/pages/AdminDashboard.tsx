import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CreateElectionDialog } from "@/components/admin/CreateElectionDialog";
import { VoterTurnoutCard } from "@/components/admin/VoterTurnoutCard";
import { ResultsCard } from "@/components/results/ResultsCard";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  role: string;
  zprn_id: string;
}

export default function AdminDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

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

    if (!profileData || profileData.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setProfile(profileData);
    await loadElections();
    setLoading(false);

    // Subscribe to real-time vote updates
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
          loadElections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadElections = async () => {
    const { data: electionsData } = await supabase
      .from("elections")
      .select(`
        *,
        candidates (*),
        votes (*),
        election_voters (*)
      `)
      .order("created_at", { ascending: false });

    if (electionsData) {
      const electionsWithVoterStatus = await Promise.all(
        electionsData.map(async (election) => {
          // Get all profiles for voters in this election
          const { data: allProfiles } = await supabase
            .from("profiles")
            .select("id, zprn_id, name");

          const voterStatuses = election.election_voters.map((ev: any) => {
            const profile = allProfiles?.find((p) => p.zprn_id === ev.zprn_id);
            const hasVoted = election.votes.some((vote: any) => {
              const voterProfile = allProfiles?.find((p) => p.id === vote.voter_id);
              return voterProfile?.zprn_id === ev.zprn_id;
            });

            return {
              zprn_id: ev.zprn_id,
              name: profile?.name,
              has_voted: hasVoted,
            };
          });

          return {
            ...election,
            voterStatuses,
          };
        })
      );

      setElections(electionsWithVoterStatus);
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
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage elections and monitor voting
            </p>
          </div>
          <div className="flex gap-3">
            {profile && <CreateElectionDialog userId={profile.id} onElectionCreated={loadElections} />}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {elections.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No elections yet. Create your first election!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {elections.map((election) => {
              const candidatesWithVotes = election.candidates.map((candidate: any) => ({
                ...candidate,
                voteCount: election.votes.filter((v: any) => v.candidate_id === candidate.id).length,
              }));

              return (
                <div key={election.id} className="grid md:grid-cols-2 gap-6">
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
