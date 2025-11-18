import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";

interface CreateElectionDialogProps {
  userId: string;
  onElectionCreated: () => void;
}

export const CreateElectionDialog = ({ userId, onElectionCreated }: CreateElectionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [candidates, setCandidates] = useState<Array<{ name: string; description: string; uniqueId: string }>>([
    { name: "", description: "", uniqueId: "" },
  ]);
  const [voterIds, setVoterIds] = useState<string[]>([""]);
  const { toast } = useToast();

  const addCandidate = () => {
    setCandidates([...candidates, { name: "", description: "", uniqueId: "" }]);
  };

  const removeCandidate = (index: number) => {
    setCandidates(candidates.filter((_, i) => i !== index));
  };

  const updateCandidate = (index: number, field: "name" | "description" | "uniqueId", value: string) => {
    const updated = [...candidates];
    updated[index][field] = value;
    setCandidates(updated);
  };

  const addVoterId = () => {
    setVoterIds([...voterIds, ""]);
  };

  const removeVoterId = (index: number) => {
    setVoterIds(voterIds.filter((_, i) => i !== index));
  };

  const updateVoterId = (index: number, value: string) => {
    const updated = [...voterIds];
    updated[index] = value;
    setVoterIds(updated);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter an election title",
        variant: "destructive",
      });
      return;
    }

    const validCandidates = candidates.filter((c) => c.name.trim());
    if (validCandidates.length < 2) {
      toast({
        title: "Error",
        description: "Please add at least 2 candidates",
        variant: "destructive",
      });
      return;
    }

    const validVoterIds = voterIds.filter((id) => id.trim());
    if (validVoterIds.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one voter ID",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create election
      const { data: election, error: electionError } = await supabase
        .from("elections")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          created_by: userId,
        })
        .select()
        .single();

      if (electionError) throw electionError;

      // Add candidates
      const { error: candidatesError } = await supabase
        .from("candidates")
        .insert(
          validCandidates.map((c) => ({
            election_id: election.id,
            name: c.name.trim(),
            description: c.description.trim() || null,
            unique_id: c.uniqueId.trim() || null,
          }))
        );

      if (candidatesError) throw candidatesError;

      // Add voter whitelist
      const { error: votersError } = await supabase
        .from("election_voters")
        .insert(
          validVoterIds.map((zprn_id) => ({
            election_id: election.id,
            zprn_id: zprn_id.trim().toUpperCase(),
          }))
        );

      if (votersError) throw votersError;

      toast({
        title: "Success!",
        description: "Election created successfully",
      });

      setOpen(false);
      setTitle("");
      setDescription("");
      setCandidates([{ name: "", description: "", uniqueId: "" }]);
      setVoterIds([""]);
      onElectionCreated();
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Election
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Election</DialogTitle>
          <DialogDescription>
            Set up a new election with candidates and eligible voters.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Election Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Student Council President 2024"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Vote for the next student council president"
            />
          </div>

          <div className="space-y-2">
            <Label>Candidates</Label>
            {candidates.map((candidate, index) => (
              <div key={index} className="space-y-2 p-4 border rounded-lg">
                <div className="flex gap-2">
                  <Input
                    placeholder="Candidate name"
                    value={candidate.name}
                    onChange={(e) => updateCandidate(index, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Unique ID (for candidate to check votes)"
                    value={candidate.uniqueId}
                    onChange={(e) => updateCandidate(index, "uniqueId", e.target.value)}
                    className="flex-1"
                  />
                  {candidates.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCandidate(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <Input
                  placeholder="Description (optional)"
                  value={candidate.description}
                  onChange={(e) => updateCandidate(index, "description", e.target.value)}
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addCandidate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Candidate
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Eligible Voter IDs (ZPRN)</Label>
            {voterIds.map((voterId, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="124BT10297"
                  value={voterId}
                  onChange={(e) => updateVoterId(index, e.target.value)}
                  className="flex-1"
                />
                {voterIds.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeVoterId(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addVoterId}>
              <Plus className="w-4 h-4 mr-2" />
              Add Voter ID
            </Button>
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create Election"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
