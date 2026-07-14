use dep::poseidon::poseidon2::Poseidon2;

// ---------------------------------------------------------------------------
// Re-exports from card_actions
// ---------------------------------------------------------------------------
pub use dep::card_actions::{derive_merkle_path, generate_merkle_tree};

// ---------------------------------------------------------------------------
// Game constants
// ---------------------------------------------------------------------------
pub global STANDARD_DECK_SIZE: u32 = 52;
pub global PLAY_CARD_PER_PLAYER_COUNT: u32 = 07;

// ---------------------------------------------------------------------------
// Fisher-Yates shuffle via Poseidon2-derived randomness. O(N^2) constraint cost.
// ---------------------------------------------------------------------------
pub fn shuffle_deck(seed: Field) -> [Field; STANDARD_DECK_SIZE] {
    let mut deck: [Field; STANDARD_DECK_SIZE] = [0; STANDARD_DECK_SIZE];
    for i in 0..STANDARD_DECK_SIZE {
        deck[i] = i as Field;
    }

    for n in 0..deck.len() {
        let i = deck.len() - 1 - n;
        let rng = Poseidon2::hash([seed, i as Field], 2);
        let j = rng as u32 % (i + 1);

        let deck_i = deck[i];
        let mut selected_value: Field = 0;
        for k in 0..(i + 1) {
            let is_j = (k == j) as Field;
            let is_i = (k == i) as Field;
            selected_value += deck[k] * is_j;
            deck[k] = deck[k] + is_j * (deck_i - deck[k]) + is_i * (selected_value - deck[k]);
        }
    }

    deck
}

// ---------------------------------------------------------------------------
// Concrete Merkle wrappers (hard-coded next_pow02 outputs for supported sizes)
//   STANDARD_DECK_SIZE = 52  ->  L = 64,  D = 6,  tree = 128
//   PLAY_CARD_PER_PLAYER_COUNT = 7  ->  L = 8,  D = 3,  tree = 16
// ---------------------------------------------------------------------------

#[export]
pub unconstrained fn deck_merkle_tree(deck: [u32; STANDARD_DECK_SIZE]) -> (Field, [Field; 128]) {
    generate_merkle_tree::<STANDARD_DECK_SIZE, 64>(deck)
}

#[export]
pub unconstrained fn hand_merkle_tree(
    hand: [u32; PLAY_CARD_PER_PLAYER_COUNT],
) -> (Field, [Field; 16]) {
    generate_merkle_tree::<PLAY_CARD_PER_PLAYER_COUNT, 8>(hand)
}

#[export]
pub unconstrained fn deck_merkle_path(tree: [Field; 128], leaf_index: u32) -> [Field; 6] {
    derive_merkle_path::<64, 6>(tree, leaf_index)
}

#[export]
pub unconstrained fn hand_merkle_path(tree: [Field; 16], leaf_index: u32) -> [Field; 3] {
    derive_merkle_path::<8, 3>(tree, leaf_index)
}

// ---------------------------------------------------------------------------
// High-level utilities
// ---------------------------------------------------------------------------

// Derive deck-membership paths for one player's contiguous 7-card hand.
// hand_offset: 0 for player 1, PLAY_CARD_PER_PLAYER_COUNT for player 2.
pub unconstrained fn derive_hand_deck_paths(
    tree: [Field; 128],
    hand_offset: u32,
) -> [[Field; 6]; PLAY_CARD_PER_PLAYER_COUNT] {
    let mut paths: [[Field; 6]; PLAY_CARD_PER_PLAYER_COUNT] = [[0; 6]; PLAY_CARD_PER_PLAYER_COUNT];
    for i in 0..PLAY_CARD_PER_PLAYER_COUNT {
        paths[i] = deck_merkle_path(tree, hand_offset + i);
    }
    paths
}

#[export]
pub unconstrained fn player1_hand_paths(
    tree: [Field; 128],
) -> [[Field; 6]; PLAY_CARD_PER_PLAYER_COUNT] {
    derive_hand_deck_paths(tree, 0)
}

#[export]
pub unconstrained fn player2_hand_paths(
    tree: [Field; 128],
) -> [[Field; 6]; PLAY_CARD_PER_PLAYER_COUNT] {
    derive_hand_deck_paths(tree, PLAY_CARD_PER_PLAYER_COUNT)
}

// ---------------------------------------------------------------------------
// Deck integrity + dealing (game logic, stays in assist)
// ---------------------------------------------------------------------------

// Grand-product permutation check. O(N) constraints.
pub fn constrain_deck_integrity<let N: u32>(
    root: Field,
    original_deck: [Field; N],
    shuffled_deck: [Field; N],
) {
    assert(original_deck.len() == shuffled_deck.len(), "[ERR: Deck]: Deck length mismatch!");

    let gamma = Poseidon2::hash([root], 1);

    let mut expected_product: Field = 1;
    let mut actual_product: Field = 1;
    for i in 0..original_deck.len() {
        expected_product *= (gamma + original_deck[i]);
        actual_product *= (gamma + shuffled_deck[i]);
    }

    assert(expected_product == actual_product, "[ERR: Deck]: Deck integrity compromised!");
}

#[export]
pub unconstrained fn deal_cards(
    seed: Field,
    ) -> ([Field; STANDARD_DECK_SIZE], Field, [Field; 128], [Field; PLAY_CARD_PER_PLAYER_COUNT], [Field; PLAY_CARD_PER_PLAYER_COUNT]) {
    let shuffled = shuffle_deck(seed);

    let mut deck_u32: [u32; STANDARD_DECK_SIZE] = [0; STANDARD_DECK_SIZE];
    for i in 0..STANDARD_DECK_SIZE {
        deck_u32[i] = shuffled[i] as u32;
    }
    let (deck_root, deck_tree) = deck_merkle_tree(deck_u32);

    let mut player01_hand: [Field; PLAY_CARD_PER_PLAYER_COUNT] = [0; PLAY_CARD_PER_PLAYER_COUNT];
    let mut player02_hand: [Field; PLAY_CARD_PER_PLAYER_COUNT] = [0; PLAY_CARD_PER_PLAYER_COUNT];
    for i in 0..PLAY_CARD_PER_PLAYER_COUNT {
        player01_hand[i] = shuffled[i];
        player02_hand[i] = shuffled[i + PLAY_CARD_PER_PLAYER_COUNT];
    }

    (shuffled, deck_root, deck_tree, player01_hand, player02_hand)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

mod tests;
