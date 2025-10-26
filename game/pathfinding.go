package game

import (
	"container/heap"
	"log"
	"math"
	"strconv"
)

// Node represents a point in the grid for pathfinding.
type Node struct {
	X, Y    int
	Parent  *Node
	G, H, F float64
	index   int // Index in the priority queue.
}

// PriorityQueue implements heap.Interface and holds Nodes.
type PriorityQueue []*Node

func (pq PriorityQueue) Len() int { return len(pq) }

func (pq PriorityQueue) Less(i, j int) bool {
	return pq[i].F < pq[j].F
}

func (pq PriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}

func (pq *PriorityQueue) Push(x interface{}) {
	n := len(*pq)
	node := x.(*Node)
	node.index = n
	*pq = append(*pq, node)
}

func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	node := old[n-1]
	old[n-1] = nil  // avoid memory leak
	node.index = -1 // for safety
	*pq = old[0 : n-1]
	return node
}

// manhattanDistance is a heuristic for A*.
func manhattanDistance(a, b *Node) float64 {
	return math.Abs(float64(a.X-b.X)) + math.Abs(float64(a.Y-b.Y))
}

// isWalkable checks if a tile is passable, allowing the destination to be a collidable target.
func isWalkable(x, y, endX, endY int) bool {
	// The destination tile is always considered "walkable" for pathfinding purposes,
	// as the goal is to find a path to an adjacent tile, not to step on the target.
	if x == endX && y == endY {
		return true
	}

	// 1. Check world boundaries (optional, but good practice)
	if x < -WorldSize/2 || x >= WorldSize/2 || y < -WorldSize/2 || y >= WorldSize/2 {
		return false
	}

	// 2. Check for tile locks
	lockKey := string(RedisKeyLockTile) + strconv.Itoa(x) + "," + strconv.Itoa(y)
	lockExists, err := rdb.Exists(ctx, lockKey).Result()
	if err != nil {
		log.Printf("[Pathfinding] Error checking tile lock for %d,%d: %v", x, y)
		return false // Fail safely
	}
	if lockExists > 0 {
		return false // Tile is locked
	}

	// 3. Check tile properties
	_, props, err := GetWorldTile(x, y)
	if err != nil {
		// This can happen if the tile doesn't exist in the world data (e.g., void).
		// Treat as unwalkable.
		return false
	}
	if props.IsCollidable {
		return false
	}

	return true
}

// FindPath implements the A* algorithm.
func FindPath(startX, startY, endX, endY int) []*Node {
	startNode := &Node{X: startX, Y: startY}
	endNode := &Node{X: endX, Y: endY}

	openSet := make(PriorityQueue, 0)
	heap.Push(&openSet, startNode)

	// nodeMap helps us find existing nodes quickly to update them.
	nodeMap := make(map[string]*Node)
	nodeMap[strconv.Itoa(startNode.X)+","+strconv.Itoa(startNode.Y)] = startNode

	closedSet := make(map[string]bool)

	for openSet.Len() > 0 {
		currentNode := heap.Pop(&openSet).(*Node)

		coordKey := strconv.Itoa(currentNode.X) + "," + strconv.Itoa(currentNode.Y)
		if closedSet[coordKey] {
			continue
		}
		closedSet[coordKey] = true

		if currentNode.X == endNode.X && currentNode.Y == endNode.Y {
			return reconstructPath(currentNode)
		}

		for _, neighborCoords := range getNeighborCoords(currentNode) {
			if !isWalkable(neighborCoords.X, neighborCoords.Y, endNode.X, endNode.Y) {
				continue
			}

			neighborKey := strconv.Itoa(neighborCoords.X) + "," + strconv.Itoa(neighborCoords.Y)
			if closedSet[neighborKey] {
				continue
			}

			gScore := currentNode.G + 1 // Cost to move to a neighbor is always 1

			neighborNode, inOpenSet := nodeMap[neighborKey]
			if !inOpenSet || gScore < neighborNode.G {
				if !inOpenSet {
					neighborNode = &Node{X: neighborCoords.X, Y: neighborCoords.Y}
					nodeMap[neighborKey] = neighborNode
				}

				neighborNode.Parent = currentNode
				neighborNode.G = gScore
				neighborNode.H = manhattanDistance(neighborNode, endNode)
				neighborNode.F = neighborNode.G + neighborNode.H

				if !inOpenSet {
					heap.Push(&openSet, neighborNode)
				} else {
					heap.Fix(&openSet, neighborNode.index) // Update priority
				}
			}
		}
	}
	return nil // No path found
}

func getNeighborCoords(node *Node) []Node {
	var neighbors []Node
	for _, d := range []struct{ dx, dy int }{{0, 1}, {0, -1}, {1, 0}, {-1, 0}} {
		neighbors = append(neighbors, Node{X: node.X + d.dx, Y: node.Y + d.dy})
	}
	return neighbors
}

func reconstructPath(node *Node) []*Node {
	var path []*Node
	for current := node; current != nil; current = current.Parent {
		path = append(path, current)
	}
	// Reverse path
	for i, j := 0, len(path)-1; i < j; i, j = i+1, j-1 {
		path[i], path[j] = path[j], path[i]
	}
	return path
}
