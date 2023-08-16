import {
    $query,
    $update,
    Record,
    StableBTreeMap,
    Vec,
    match,
    Result,
    nat64,
    ic,
    Opt,
    Principal
} from 'azle';
import { v4 as uuidv4 } from 'uuid';

/**
 * This type represents A proposal that will be created in our dao.
 */
type Proposal = Record<{
    owner: Principal; // owner of proposal
    id: string; // id of proposal
    title: string; // title of proposal
    description: string; // description of proposal
    voters: Vec<string>; // list of voters
    yesVotes: number; // number of yesVotes of proposal
    noVotes: number; // number of noVotes of proposal
    created_at: nat64; // time stamp of the creation of the proposal
    updated_at: Opt<nat64>; // updated time stamp
}>;

// Define a Record to store the user input when creating a new proposal
type ProposalPayload = Record<{
    title: string;
    description: string;
}>;

/**
 * `proposalStorage` - it's a key-value data structure that is used to store proposals.
 * For the sake of this contract, we've chosen {@link StableBTreeMap} as a storage for the following reasons:
 * - `insert`, `get`, and `remove` operations have a constant time complexity - O(1)
 * 
 * Breakdown of the `StableBTreeMap<string, Proposal>` data structure:
 * - The key of the map is a `proposalId`.
 * - The value in this map is a proposal itself `proposal` that is related to a given key (`proposalId`).
 * 
 * Constructor values:
 * 1) 0 - memory id where to initialize a map.
 * 2) 44 - it's a max size of the key in bytes (size of the UUID value that we use for IDs).
 * 3) 1024 - it's a max size of the value in bytes.
 * 2 and 3 are not being used directly in the constructor but the Azle compiler utilizes these values during compile time.
 */
const proposalStorage = new StableBTreeMap<string, Proposal>(0, 44, 1024);

/**
 * Retrieve all proposals
 */
$query;
export function getProposals(): Result<Vec<Proposal>, string> {
    return Result.Ok(proposalStorage.values());
}

/**
 * Retrieve proposal by Id
 */
$query;
export function getProposal(id: string): Result<Proposal, string> {
    return match(proposalStorage.get(id), {
        Some: (proposal) => Result.Ok<Proposal, string>(proposal),
        None: () => Result.Err<Proposal, string>(`A proposal with id=${id} not found`)
    });
}

/**
 * Creating a new proposal
 */
$update;
export function createProposal(payload: ProposalPayload): Result<Proposal, string> {
    const { title, description } = payload;

    // Input validation
    if (!title || !description) {
        return Result.Err<Proposal, string>('Missing required fields');
    }

    const proposal: Proposal = {
        owner: ic.caller(),
        id: uuidv4(),
        title,
        description,
        voters: [],
        yesVotes: 0,
        noVotes: 0,
        created_at: ic.time(),
        updated_at: Opt.None
    };

    proposalStorage.insert(proposal.id, proposal);
    return Result.Ok(proposal);
}

/**
 * Users can vote yes for a proposal
 */
$update;
export function voteYes(id: string): Result<Proposal, string> {
    return match(proposalStorage.get(id), {
        Some: (proposal) => {
            if (proposal.owner.toString() === ic.caller().toString()) {
                return Result.Err<Proposal, string>("Owners cannot vote for their own proposal");
            }

            const hasVoted = proposal.voters.includes(ic.caller().toString());

            if (hasVoted) {
                return Result.Err<Proposal, string>("Already voted");
            }

            const updatedProposal: Proposal = { ...proposal, yesVotes: proposal.yesVotes + 1, updated_at: Opt.Some(ic.time()) };
            proposalStorage.insert(proposal.id, updatedProposal);
            return Result.Ok<Proposal, string>(updatedProposal);
        },
        None: () => Result.Err<Proposal, string>(`Couldn't update a proposal with id=${id}. Proposal not found`)
    });
}

/**
 * Users can vote no for a proposal
 */
$update;
export function voteNo(id: string): Result<Proposal, string> {
    return match(proposalStorage.get(id), {
        Some: (proposal) => {
            if (proposal.owner.toString() === ic.caller().toString()) {
                return Result.Err<Proposal, string>("Owners cannot vote for their own proposal");
            }

            const hasVoted = proposal.voters.includes(ic.caller().toString());

            if (hasVoted) {
                return Result.Err<Proposal, string>("Already voted");
            }

            const updatedProposal: Proposal = { ...proposal, noVotes: proposal.noVotes + 1, updated_at: Opt.Some(ic.time()) };
            proposalStorage.insert(proposal.id, updatedProposal);
            return Result.Ok<Proposal, string>(updatedProposal);
        },
        None: () => Result.Err<Proposal, string>(`Couldn't update a proposal with id=${id}. Proposal not found`)
    });
}

/**
 * Updating a proposal
 */
$update;
export function updateProposal(id: string, payload: ProposalPayload): Result<Proposal, string> {
    return match(proposalStorage.get(id), {
        Some: (proposal) => {
            if (proposal.owner.toString() !== ic.caller().toString()) {
                return Result.Err<Proposal, string>("Only the owner of a proposal can update it");
            }

            const updatedProposal: Proposal = { ...proposal, ...payload, updated_at: Opt.Some(ic.time()) };
            proposalStorage.insert(proposal.id, updatedProposal);
            return Result.Ok<Proposal, string>(updatedProposal);
        },
        None: () => Result.Err<Proposal, string>(`Couldn't update a proposal with id=${id}. Proposal not found`)
    });
}

/**
 * Deleting a proposal
 */
$update;
export function deleteProposal(id: string): Result<Proposal, string> {
    return match(proposalStorage.remove(id), {
        Some: (deletedProposal) => Result.Ok<Proposal, string>(deletedProposal),
        None: () => Result.Err<Proposal, string>(`Couldn't delete a proposal with id=${id}. Proposal not found.`)
    });
}

// A workaround to make uuid package work with Azle
globalThis.crypto = {
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    }
};
