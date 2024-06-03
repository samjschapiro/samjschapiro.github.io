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

## Scientific Creativity Setting
Let $\mathcal{E}$ represent the complete set of ideas within the entire scientific enterprise, $\mathcal{D}$ represent the domain of ideas specific to a particular discipline, $\mathcal{I}$ represent an individual's set of ideas, and $\mathcal{Z}$ represent the zeitgeist of that discipline, which is a set of _open problems_ that the field has determined are valuable or important to solve. In order to satisfy an open problem of the zeitgeist, one must search over $\mathcal{D}$ — and perhaps more broadly over $\mathcal{E}$ — to find a permutation of ideas that satisfies some open problem $z \in \mathcal{Z}$ belonging to the zeitgeist. Define $N_\mathcal{I} := |\mathcal{I}|, N_\mathcal{D} := |\mathcal{D}|, N_\mathcal{E} := |\mathcal{E}|$ as the number of ideas belonging to the individual, domain, and entire scientific enterprise, respectively. Then, there are $C_\mathcal{I} := \sum_{i=1}^{N_\mathcal{I}} \frac{(N_\mathcal{I})!}{(N_\mathcal{I} - i)!}$ permutations of ideas within an individual's knowledge, $C_\mathcal{D} := \sum_{i=1}^{N_\mathcal{D}} \frac{(N_\mathcal{D})!}{(N_\mathcal{D} - i)!}$ permutations of ideas within the discipline's knowledge, and $C_\mathcal{E} := \sum_{i=1}^{N_\mathcal{E}} \frac{(N_\mathcal{E})!}{(N_\mathcal{E} - i)!}$ permutations of ideas within the entire scientific enterprise. Clearly, there are far more permutations of ideas — even within the individual's knowledge — than is reasonable to efficiently search. This is clearly a pessimistic measure of search complexity, and, instead, it is likely that heuristics are used to determine more probable combinations.

### The Semantic Similarity Heuristic Hypothesis
Let $z \in \mathcal{Z}$ be an open problem in the zeitgeist, $E$ be a semantic encoder, and $s$ be a semantic similarity score. Then $S_\mathcal{I}(z) := \left[s(E(z), E(d)) ~ | ~ d \in \mathcal{I}\right]$ is the list of similarity scores between an individual's ideas and an open problem, sorted in descending order. An individual may only search over the top $k$ elements of $S_\mathcal{I}(z)$. Furthermore, for each of the top $k$ elements of $S_\mathcal{I}(z)$, denoted $d_i, ~ i \in [k]$, the individual may search recursively over $S_\mathcal{I}(d_i)$'s top $k$ elements too.



## A Theory of Human Scientific Creativity 
Evidently, the number of ideas $N_\mathcal{I}$ an individual has is a bottleneck to scientific creativity. The facet _openness to ideas_ of trait openness to experience facilitates the rate of integration of new ideas into an individuals set of ideas $\mathcal{I}$. A linear differential equation modeling the rate of acquisition of new scientific ideas can be given by $$\frac{\mathrm{d} N_\mathcal{I}}{\mathrm{d} t} = r N_\mathcal{I}, ~~ r > 0$$
The facet _openness to fantasy_ of trait openness to experience is known to be linked closely to human creativity.
