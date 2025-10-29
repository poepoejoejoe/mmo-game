package game

import (
	"container/heap"
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
func isWalkable(x, y, endX, endY int, tickCache *TickCache) bool {
	// The destination tile is always considered "walkable" for pathfinding purposes,
	// as the goal is to find a path to an adjacent tile, not to step on the target.
	if x == endX && y == endY {
		return true
	}

	coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)

	// 1. Check world boundaries
	if x < -WorldSize || x > WorldSize || y < -WorldSize || y > WorldSize {
		return false
	}

	// 2. Check for tile locks from the tick-local cache
	if tickCache.LockedTiles[coordKey] {
		return false
	}

	// 3. Check tile properties from the global in-memory grid
	if tickCache.CollisionGrid[coordKey] {
		return false // Tile is collidable
	}

	return true
}

// FindPath implements the A* algorithm.
func FindPath(startX, startY, endX, endY int, tickCache *TickCache) []*Node {
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
			if !isWalkable(neighborCoords.X, neighborCoords.Y, endNode.X, endNode.Y, tickCache) {
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

// FindPathToAdjacent finds a path from a start point to a tile adjacent to the target endpoint.
// This is useful for things like resource gathering or interacting with objects where the
// character needs to be next to the target, not on top of it.
func FindPathToAdjacent(startX, startY, endX, endY int, tickCache *TickCache) []*Node {
	var bestPath []*Node
	var closestDist float64 = -1

	// Check all four neighbors of the target tile
	for _, neighbor := range getNeighborCoords(&Node{X: endX, Y: endY}) {
		// The isWalkable check for the pathfinder's destination is special.
		// Here, we need to know if the tile is *actually* walkable for a move.
		if isActuallyWalkable(neighbor.X, neighbor.Y, tickCache) {
			path := FindPath(startX, startY, neighbor.X, neighbor.Y, tickCache)
			if path != nil {
				// We found a valid path. See if it's the best one so far.
				// "Best" is defined as the shortest path.
				pathLength := float64(len(path))
				if bestPath == nil || pathLength < closestDist {
					bestPath = path
					closestDist = pathLength
				}
			}
		}
	}

	return bestPath
}

// isActuallyWalkable is a stricter version of isWalkable that does not
// treat the destination as a special case. It checks if a tile can
// actually be moved onto.
func isActuallyWalkable(x, y int, tickCache *TickCache) bool {
	coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)

	// 1. Check world boundaries
	if x < -WorldSize || x > WorldSize || y < -WorldSize || y > WorldSize {
		return false
	}

	// 2. Check for tile locks from the tick-local cache
	if tickCache.LockedTiles[coordKey] {
		return false
	}

	// 3. Check tile properties from the global in-memory grid
	if tickCache.CollisionGrid[coordKey] {
		return false // Tile is collidable
	}

	return true
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
