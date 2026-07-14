use dep::poseidon::poseidon2::Poseidon2;

pub global LEAF_SEPARATOR: Field = 1234;
pub global LEAF_PADDING: Field = 254;

pub fn hash_leaf_node(leaf: Field) -> Field {
    Poseidon2::hash([leaf, LEAF_SEPARATOR], 02)
}

pub fn hash_node_pair(left: Field, right: Field) -> Field {
    Poseidon2::hash([left, right], 02)
}

pub fn next_pow02<let N: u32>(value: u32) -> (u32, u32) {
    assert(value > 0, "[ERR: zk] value must be greater than 0");

    // calculating bit length via repeated right-shift
    let mut bit_length: u32 = 0;
    let mut v: u32 = value;
    for _ in 0..N {
        if v != 0 {
            v >>= 1;
            bit_length += 1;
        }
    }

    // power-of-2 check via BitAnd
    let is_pow02: bool = (value & (value - 1)) == 0;

    if is_pow02 {
        (value, bit_length - 1)
    } else {
        let next: u32 = 1 << bit_length;
        (next, bit_length)
    }
}

// L must equal next_pow02(N).0 - the caller supplies it as a generic so the
// compiler can resolve the tree array size at compile time.
// tree layout: 1-indexed binary heap - tree[1]=root, tree[L..2L-1]=leaves.
pub unconstrained fn generate_merkle_tree<let N: u32, let L: u32>(
    deck: [u32; N],
) -> (Field, [Field; 2 * L]) {
    let mut tree: [Field; 2 * L] = [0; 2 * L];

    // hash real deck cards into the leaf slots
    for i in 0..N {
        tree[L + i] = hash_leaf_node(deck[i] as Field);
    }
    // pad remaining leaves with the domain-separated padding sentinel
    for i in N..L {
        tree[L + i] = hash_leaf_node(LEAF_PADDING);
    }

    // build internal nodes bottom-up (idx L-1 down to 1)
    for i in 0..(L - 1) {
        let idx: u32 = (L - 1) - i;
        tree[idx] = hash_node_pair(tree[2 * idx], tree[2 * idx + 1]);
    }

    (tree[1], tree)
}

// Derive the Merkle path (sibling hashes) for the leaf at position `leaf_index`.
//
// Generics:
//   L = number of leaf slots (must be a power of 2)
//   D = tree depth, so L == 2^D
//
// Returns the D siblings collected from leaf level up to just under the root.
pub unconstrained fn derive_merkle_path<let L: u32, let D: u32>(
    tree: [Field; 2 * L],
    leaf_index: u32,
) -> [Field; D] {
    assert(leaf_index < L, "[ERR: zk] leaf_index out of range");

    let mut path: [Field; D] = [0; D];
    let mut node_idx: u32 = L + leaf_index;

    for i in 0..D {
        // sibling sits at node_idx XOR 1 (flips last bit: left <-> right child)
        let sibling_idx: u32 = node_idx ^ 1;
        path[i] = tree[sibling_idx];
        node_idx = node_idx / 2;
    }

    path
}

// Generic over tree depth D.
pub fn verify_merkle_path<let D: u32>(
    leaf_hash: Field,
    leaf_index: u32,
    path: [Field; D],
    root: Field,
) {
    let mut current = leaf_hash;
    let mut idx = leaf_index;
    for i in 0..D {
        let sibling = path[i];
        if (idx & 1) == 1 {
            current = hash_node_pair(sibling, current);
        } else {
            current = hash_node_pair(current, sibling);
        }
        idx = idx >> 1;
    }
    assert(current == root);
}
