---
title: 'A Mathematical Theory of Scientific Creativity'
date: 2024-06-03
permalink: /posts/2024/06/a-mathematical-theory-of-scientific-creativity/
tags:
  - psychology
  - intelligence
  - machine learning
---

## Introduction

The zeitgeist of the AI revolution is the spirit that any intelligent behavior or process, human or not, can be implemented computationally and understood mathematically. Following this belief, we attempt to provide an agent-agnostic mathematical theory of scientific creativity with sufficient specificity so as to enable one to implement the process computationally. In this essay, we detail the setting of scientific creativity, posit several hypotheses for idea permutation heuristics, and relate the theory back to human scientific creativity.

## Existing Formulations of Creativity

Creativity is the process by which novel, useful, and surprising ideas are generated. Ideas can be characterized by their _novelty_ in the form of the initial generation probability $p \in [0, 1]$, their _utility_ $u \in [0, 1]$, and the person's prior knowledge of that final utility $v \in [0, 1]$, representing the inverse of _surprise_ $(1 - v)$. 


## Scientific Creativity Setting
Let $\mathcal{E}$ represent the set of ideas within the entire scientific enterprise, $\mathcal{D}$ represent the domain of ideas specific to a particular discipline, $\mathcal{I}$ represent an individual's set of ideas, and $\mathcal{Z}$ represent the zeitgeist of that discipline, which is a set of _open problems_ that the field has determined are valuable or important to solve. In order to satisfy an open problem of the zeitgeist, one must search over $\mathcal{D}$ — and perhaps more broadly over $\mathcal{E}$ — to find a permutation of ideas that satisfies some open problem $z \in \mathcal{Z}$ belonging to the zeitgeist. Define $N_\mathcal{I} := |\mathcal{I}|$, $N_\mathcal{D} := |\mathcal{D}|$, $N_\mathcal{E} := |\mathcal{E}|$ as the number of ideas belonging to the individual, domain, and entire scientific enterprise, respectively. Then, there are $C_\mathcal{I} := \sum_{i=1}^{N_\mathcal{I}} \frac{(N_\mathcal{I})!}{(N_\mathcal{I} - i)!}$ permutations of ideas within an individual's knowledge, $C_\mathcal{D} := \sum_{i=1}^{N_\mathcal{D}} \frac{(N_\mathcal{D})!}{(N_\mathcal{D} - i)!}$ permutations of ideas within the discipline's knowledge, and $C_\mathcal{E} := \sum_{i=1}^{N_\mathcal{E}} \frac{(N_\mathcal{E})!}{(N_\mathcal{E} - i)!}$ permutations of ideas within the entire scientific enterprise. Since permutations grow factorially in the number of ideas, there are many more permutations than is reasonable to  search naively. It is therefore likely that heuristics are used to determine permutations with higher probabilities of being useful. Later on, we present several possible heuristic hypotheses, whose continued development should be the subject of future study.

### The Semantic Similarity Hypothesis
Let $z \in \mathcal{Z}$ be an open problem in the zeitgeist, $E_\mathcal{D}$ be a semantic encoder trained over a discipline $\mathcal{D}$, and $s$ be a semantic similarity score. Then $S_\mathcal{I}(z; \mathcal{D}) := \left[s(E_\mathcal{D}(z), E_\mathcal{D}(d)) ~ | ~ d \in \mathcal{I}\right]$ is the list of similarity scores between a set of ideas $\mathcal{I}$ and an open problem, sorted in descending order. The **semantic similarity hypothesis** states that the probability an idea $z' \in S_\mathcal{I}(z)$ is chosen to be evaluated as a solution for $z$, or later used in an idea permutation if $z'$ is not a solution to $z$, is proportional to the similarity score $s(E_\mathcal{D}(z), E_\mathcal{D}(z'))$.

### Novelty, Utility, and Surprise in the Scientific Creativity Setting

The difficulty of most open problems is that their solutions are non-obvious (or "surprising") with respect to that discipline's body of knowledge $\mathcal{D}$. Otherwise, experts of that discipline would have already solved it. Given an open problem $z \in \mathcal{Z}$ and an idea $d^\star$ or permutation of ideas $[d_1^\star, \dots, d_k^\star]$ that solves problem $z$, we can take non-obviousness to mean that $E_\mathcal{D}(z, d^\star)$ is small or $E_\mathcal{D}(z, d_j^\star)$ is small for all $j \in [k]$. 

Note, however, that within the encompassing scientific enterprise $\mathcal{E}$, a creative idea may cease to be surprising because $E_\mathcal{E}(z, d^\star)$ may be large or $E_\mathcal{E}(z, d_j^\star)$ may not be small for all $j \in [k]$.


## A Theory of Human Scientific Creativity 
Evidently, the number of ideas $N_\mathcal{I}$ an individual has is a bottleneck to scientific creativity. The facet _openness to ideas_ of trait openness to experience facilitates the rate of integration of new ideas into an individuals set of ideas $\mathcal{I}$. A linear differential equation modeling the rate of acquisition of new scientific ideas can be given by $$\frac{\mathrm{d} N_\mathcal{I}}{\mathrm{d} t} = r N_\mathcal{I}, ~~ r > 0$$
The facet _openness to fantasy_ of trait openness to experience is known to be linked closely to human creativity.
