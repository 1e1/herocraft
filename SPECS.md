# HEROCRAFT — Software Specifications & Architecture Rules

Document Version: 1.0.0  
Status: ACTIVE / LIVING SPEC  
Formalism: Rule-Based Formal Specifications (`[SPEC-<DOMAIN>-<ID>]`)

---

## 1. System & Display Specifications (`SPEC-SYS`)

### `[SPEC-SYS-001]` Display Target & Aspect Ratio
* **Definition**: Le jeu s'affiche sur un écran fixe 16:9 sans défilement de caméra (*Fixed Single-Screen Diorama*).
* **Reference Resolution**: $3840 \times 2160$ px (Ultra HD 4K).
* **Viewport Constraint**: Le plateau entier doit être visible en permanence par tous les joueurs (1 à 4) sur le téléviseur.

### `[SPEC-SYS-002]` Graphic Pipeline Standard
* **Engine**: Babylon.js.
* **Target API**: WebGL 2.0 (compatibilité stricte Smart TV Tizen / webOS / Chromium). WebGPU exclu initialement.
* **Performance Budget**:
  * Frame rate cible : 60 FPS constants.
  * Max Draw Calls : $< 60$ par frame via instancing des meshes (arbres, dalles, rochers).
  * Mesh polycount total : $< 100\,000$ triangles pour la scène complète.

### `[SPEC-SYS-003]` Pure Core Decoupling
* **Invariant**: Le package `core` (règles, génération, pathfinding) ne dépend d'aucune bibliothèque DOM, Canvas ou WebGL.
* **Portability**: Exécutable à l'identique dans le navigateur client et dans un runtime Node.js headless autoritaire.

---

## 2. Grid & Topology Specifications (`SPEC-MAP`)

### `[SPEC-MAP-001]` Discrete Tile Grid Dimension
* **Unit Size**: 1 unité de grille = 72 pixels natifs en résolution 4K.
* **Grid Width ($W$)**: $\lfloor 3840 / 72 \rfloor = 53{,}33 \rightarrow$ **54 colonnes** ($x \in [0, 53]$).
* **Grid Height ($H$)**: $2160 / 72 =$ **30 lignes** ($y \in [0, 29]$).
* **Total Tile Count**: $54 \times 30 = 1\,620$ tuiles par carte.

### `[SPEC-MAP-002]` Coordinate System
* **Grid Coordinates**: $(x, y) \in \mathbb{N}^2, 0 \le x < 54, 0 \le y < 30$. Origine $(0,0)$ au coin supérieur gauche.
* **World Coordinates (Babylon.js)**:
  * Centre de la tuile $(x, y)$ : $X_w = (x - 26.5) \cdot s$, $Z_w = -(y - 14.5) \cdot s$, où $s$ est le pas d'échelle 3D ($s = 1.0$).
  * Axe $Y_w$ : Altitude verticale calculée à partir de la heightmap.

### `[SPEC-MAP-003]` Entity Footprints
* **Tile Default**: $1 \times 1$ unité.
* **Héros (`HERO_FOOTPRINT`)**: $2 \times 2$ unités ($W_h = 2, H_h = 2$). Le point d'ancrage logique est le coin supérieur gauche $(x, y)$.
* **Bâtiments / Camps**: Variables ($3 \times 3$, $2 \times 4$, etc.), toujours calés sur la grille discrète.

---

## 3. Determinism & Geological Pipeline (`SPEC-GEO`)

### `[SPEC-GEO-001]` Deterministic PRNG
* **Algorithm**: Mulberry32 32-bit PRNG.
* **Reproducibility Invariant**: À partir d'un entier `seed` $\in [0, 2^{32}-1]$, la séquence de nombres pseudo-aléatoires générée sur un runtime Node.js et sur un navigateur Web doit être bit-exacte.
* **Seed Hashing**: Tout chaîne de caractères est préalablement hachée via MurmurHash3 / FNV-1a pour produire un entier 32 bits non signé.

### `[SPEC-GEO-002]` Multi-Stage Pipeline Sequence
La génération d'une carte s'exécute strictement selon l'ordre séquentiel suivant :
1. `PRNG Init`
2. `Functional Layout Partitioning` (`[SPEC-TOP-001]` : Salles & Couloirs HeroQuest)
3. `Lithology Matrix Assignment` (`[SPEC-GEO-005]` : Dureté des roches & matériaux)
4. `Cataclysmic Event Injection` (`[SPEC-GEO-006]` : Cratère, Volcan ou Faille de Rift)
5. `Tectonic Faults & Base Topography` (Voronoi & Crêtes)
6. `Differential Thermal & Hydraulic Erosion` (Résistance selon lithologie)
7. `Hydrology & Water Filling` (Lacs, dépressions, cours d'eau)
8. `Climate Classification` (Moisture / Temperature)
9. `Biome Assignment & Weight Blending` (1 à 4 biomes)
10. `Props & Vegetation Scattering` (Poisson-disc sampling)
11. `NavGrid & Clearance Matrix Computation`

### `[SPEC-GEO-003]` Tectonic Voronoi Cells
* **Plate Count**: $P \in [4, 8]$ plaques tectoniques générées par dispersion de germes avec jitter déterministe.
* **Plate Elevation**: Chaque plaque possède une hauteur de base $h_{base} \in [0.1, 0.9]$.
* **Fault Lines**: Les bordures entre deux cellules Voronoi génèrent des zones de surrection (crêtes de collision) ou de subduction (failles/faiblesses fluviales).

### `[SPEC-GEO-004]` Height Quantization
* L'altitude continue $h_{raw} \in [0.0, 1.0]$ peut être discrétisée en **8 paliers topographiques** ($L \in [0, 7]$) pour créer le style de terrasses et dioramas façon Warcraft III / HeroQuest.
* $L = \lfloor h_{raw} \times 8 \rfloor$.

### `[SPEC-GEO-005]` Lithology & Rock Hardness Strata
* Chaque zone de la carte se voit attribuer un type de roche géologique avec un coefficient d'érosion et de dureté :
  1. `LITHO_GRANITE` (Dureté $1.0$) : Crêtes acérées, falaises verticales infranchissables, résiste à l'érosion.
  2. `LITHO_SANDSTONE` (Dureté $0.6$) : Plateaux étagés, strates horizontales (canyons et mesas).
  3. `LITHO_ALLUVIUM` (Dureté $0.2$) : Terres meubles, vallées planes, sédiments fluviaux propices aux campements.
  4. `LITHO_VOLCANIC` (Dureté $0.85$) : Basalte sombre, caldeira, lave séchée et scories.
  5. `LITHO_METEORIC` (Dureté $0.95$) : Verre d'impact (impactite), suévite, brèches météoritiques.

### `[SPEC-GEO-006]` Cataclysmic Events (Rare Geological Wonders)
Chaque secteur a une probabilité d'accueillir un cataclysme géologique remarquable :
1. `CATACLYSM_CRATER` : Cratère d'impact d'astéroïde circulaire avec bourrelet d'éjectas surélevé ($+0.25$), cuvette centrale excavée ($-0.35$) pouvant former un lac d'impact, et cœur de minerai stellaire.
2. `CATACLYSM_VOLCANO` : Cône volcanique surélevé ($+0.40$) avec cratère sommital effondré et coulées de lave/basalte rayonnantes.
3. `CATACLYSM_RIFT` : Faille tectonique béante fendant la carte en deux le long d'un axe diagonal, formant un canyon abrupt franchissable uniquement par 1 ou 2 ponts rocheux naturels.
4. `CATACLYSM_NONE` : Relief tectonique standard avec strates et vallées équilibrées.

---

## 3b. Functional Tabletop Topology (`SPEC-TOP`)

### `[SPEC-TOP-001]` HeroQuest Functional Layout (Rooms, Corridors & Choke Points)
* **Design Principle**: La carte ne doit pas être une étendue continue uniforme mais un **donjon de plein air** structuré en pièces tactiques et voies d'accès.
* **Structure Requirements**:
  * **6 à 9 Salles Naturelles (Rooms / Glades)** : Zones dégagées plates ($5 \times 5$ à $9 \times 9$ cases) adaptées à l'exploration, l'installation de campements, les nids de monstres ou les gisements.
  * **Murs Naturels (Natural Walls)** : Crêtes montagneuses impénétrables, falaises abruptes ou dépressions aquatiques séparant les salles.
  * **Couloirs & Goulots d'Étranglement (Choke Points)** : Passages étroits de largeur $2$ à $3$ tuiles (défilés de canyon, cols de montagne, gués fluviaux) que les héros $2 \times 2$ peuvent verrouiller tactiquement.

---

## 4. Erosion Physical Simulation (`SPEC-ERO`)

### `[SPEC-ERO-001]` Thermal Erosion (Talus Angle)
* **Angle of Repose Threshold ($\theta_{max}$)** : $\Delta h_{max} = 0.20$ (entre cases adjacentes orthogonales).
* **Rule**: Si pour une case $C(x, y)$ et un voisin $V$, $\Delta h = h(C) - h(V) > \Delta h_{max}$, une fraction $k_t = 0.5$ de l'excès $(\Delta h - \Delta h_{max})$ est transférée de $C$ vers $V$.
* **Iterations**: $N_{thermal} \in [5, 15]$ passes synchrones.

### `[SPEC-ERO-002]` Hydraulic Erosion (Droplet Simulation)
* **Droplet Count**: $N_{drops} = 2\,000$ à $5\,000$ particules lâchées selon la seed.
* **Droplet State**: Position $(x_f, y_f)$, Vélocité $\vec{v}$, Eau $w$, Sédiment $s$.
* **Physics Rules**:
  * La goutte accélère selon le gradient de pente normalisé $-\nabla h$.
  * Capacité de transport : $c = \max(|\vec{v}| \cdot w \cdot k_c, s_{min})$.
  * Si $s < c$ : Érosion du sol $\Delta s = (c - s) \cdot k_{erode}$, creusant le lit.
  * Si $s > c$ : Dépôt sédimentaire $\Delta s = (s - c) \cdot k_{deposit}$.
  * Évaporation : $w \leftarrow w \cdot (1 - k_{evap})$.

---

## 5. Biomes & Blending (`SPEC-BIO`)

### `[SPEC-BIO-001]` Supported Biomes
Le système supporte 4 biomes fondamentaux configurables :
1. `BIOME_PLAINS` (Plaines verdoyantes type Zelda BotW, herbe lumineuse, fleurs, arbres feuillus).
2. `BIOME_FOREST` (Forêt d'automne tempérée, sous-bois denses, mousses, feuillages rougeoyants/ocres).
3. `BIOME_HIGHLANDS` (Plateaux rocheux & montagnes arides, dalles calcaires/ardoises, buissons secs).
4. `BIOME_SWAMP` (Marécage brumeux, eaux sombres, joncs, saules et racines apparentes).

### `[SPEC-BIO-002]` Biome Partitioning & Active Count
* L'utilisateur ou le scénario choisit $N_{bio} \in [1, 4]$ biomes actifs sur la carte.
* Si $N_{bio} = 1$ : Le biome sélectionné s'applique à toute la carte avec variations de sous-types.
* Si $N_{bio} \in [2, 4]$ : Répartition selon le diagramme (Température $T$, Humidité $M$, Altitude $H$).
* **Natural Transition**: Le poids de chaque biome $w_b(x, y)$ est calculé par interpolation gaussienne / smoothstep. La somme des poids vérifie $\sum_{b} w_b(x, y) = 1.0$.

---

## 6. Hydrology & Water Bodies (`SPEC-WAT`)

### `[SPEC-WAT-001]` Sea & Basin Levels
* **Water Table Threshold**: $h_{water} = 0.22$.
* Toute tuile avec $h \le h_{water}$ est immergée (`isWater = true`).
* **Water Classification**:
  * Si $h \in [h_{water} - 0.06, h_{water}]$ : `SHALLOW_WATER` (Gué praticable à vitesse réduite).
  * Si $h < h_{water} - 0.06$ : `DEEP_WATER` (Eau profonde infranchissable à pied).

### `[SPEC-WAT-002]` River Network Generation
* Les rivières naissent dans les bassins d'érosion haute altitude et descendent par plus grande pente vers le niveau d'eau le plus bas ou une sortie de carte.
* Largeur de rivière : 1 tuile (peut être franchie sur les gués désignés).

### `[SPEC-WAT-003]` Dynamic Water Plane & Shore Foam
* **Water Surface**: L'eau est rendue via un plan 3D semi-transparent indépendant à l'altitude $Y = h_{water} \cdot \text{heightScale}$.
* **Foam Effect**: Les sommets du plan d'eau en contact avec des tuiles de terre sèche ($h > h_{water}$) génèrent un contour d'écume blanche opaque.
* **Wave Oscillation**: Une légère ondulation sinusoïdale de surface $y(t) = y_0 + A \cdot \sin(\omega t + \phi)$ anime les étendues d'eau.

---

## 7. Navigation, Clearance & Pathfinding (`SPEC-NAV`)

### `[SPEC-NAV-001]` Walkability Predicate
Une tuile $T(x, y)$ est franchissable à pied par un agent $1 \times 1$ si et seulement si :
$$\text{walkable}(x, y) \iff \neg \text{isCliff}(x, y) \land \neg \text{isDeepWater}(x, y) \land \neg \text{hasSolidObstacle}(x, y)$$
où :
* $\text{isCliff}(x, y) \iff \exists V \in \text{Neighbors}(T), |h(T) - h(V)| > \Delta h_{cliff}$ ($\Delta h_{cliff} = 0.22$).
* $\text{hasSolidObstacle}(x, y)$ : présence d'un tronc d'arbre massif, rocher ou mur infranchissable.

### `[SPEC-NAV-002]` Hero 2x2 Clearance Field
Pour gérer les entités $2 \times 2$ unités sans ralentir l'algorithme A* :
* **Définition de Clearance** : $C(x, y)$ est la taille de la plus grande boîte carrée d'origine $(x, y)$ s'étendant vers $(x+k, y+k)$ entièrement composée de tuiles $\text{walkable}$.
* **Formule de récurrence (Bottom-Up Dynamic Programming)** :
  $$C(x, y) = \begin{cases} 
  0 & \text{si } \neg \text{walkable}(x, y) \\
  1 + \min(C(x+1, y), C(x, y+1), C(x+1, y+1)) & \text{si } \text{walkable}(x, y)
  \end{cases}$$
* **Règle de mouvement Héros** : Un héros $2 \times 2$ peut occuper la position $(x, y)$ ssi $C(x, y) \ge 2$.

### `[SPEC-NAV-003]` A* Pathfinding Specifications
* **Heuristique** : Distance Octile ou Euclidienne avec pénalité diagonale.
* **Diagonal Movement Rules** : Le franchissement diagonal de $(x, y)$ vers $(x+1, y+1)$ est strictement interdit si l'un des deux coins orthogonaux $((x+1, y)$ ou $(x, y+1))$ est non franchissable (*No corner-cutting*).
* **Movement Costs** :
  * Tuile plate sèche : $1.0$.
  * Diagonale plate : $\sqrt{2} \approx 1.414$.
  * Eau peu profonde (gué) : coût $\times 2.0$.
  * Dénivelé montant ($\Delta h > 0$) : coût $+ 1.5 \cdot \Delta h$.

---

## 8. Construction & Game Objective (`SPEC-BLD`)

### `[SPEC-BLD-001]` Hold-and-Build Objective
* Chaque carte générée propose un objectif principal parmi :
  1. `OBJECTIVE_CAMP` : Établir un camp fortifié et allumer le feu central.
  2. `OBJECTIVE_PIROGUE` : Construire une embarcation côtière/fluviale en bordure d'eau navigable.
  3. `OBJECTIVE_AIRSHIP` : Assembler un ballon dirigeable sur un plateau d'altitude dégagé.
  4. `OBJECTIVE_SHELTER` : Bâtir un abri fortifié contre la montagne.
* **Victoire de carte** : Tenir la position pendant la durée de construction $T_{build}$, résister aux événements hostiles, puis évacuer par la structure terminée.

### `[SPEC-BLD-002]` Foundation Buildability Map
Une zone de dimensions $W_b \times H_b$ est déclarée `buildable` à l'ancrage $(x, y)$ ssi :
1. Pour toute tuile de la zone : $\text{walkable} = \text{true}$ et $\text{isWater} = \text{false}$.
2. Dénivelé max interne : $\max(h) - \min(h) \le 0.05$ (terrain plat).
3. Zéro obstacle solide (aucun arbre, rocher ou ruine dans l'emprise).
4. Connectivité garantie : il existe un chemin A* depuis la zone de spawn des héros jusqu'à la zone de construction.

### `[SPEC-BLD-003]` Real-Time Interactive Building Placement
* **Structure Catalogs**:
  * `STRUCTURE_CAMP` : $3 \times 3$ tuiles (Feu central, tentes).
  * `STRUCTURE_PIROGUE` : $2 \times 4$ tuiles (Nécessite au moins 2 tuiles en contact avec l'eau).
  * `STRUCTURE_AIRSHIP` : $4 \times 4$ tuiles (Nécessite un plateau d'altitude $h \ge 0.50$).
  * `STRUCTURE_PALISADE` : $1 \times 1$ tuile (Mur défensif bloquant les monstres et les héros).
* **Dynamic Grid Mutation**: Lors de la pose d'une structure, les tuiles occupées deviennent des obstacles solides, la matrice de franchissabilité $\text{walkable}$ et le champ de dégagement $\text{clearance}$ sont recalculés instantanément, forçant le pathfinding à contourner la construction.

---

## 9. Map Transitions & Continuity (`SPEC-TRN`)

### `[SPEC-TRN-001]` World Macro Graph
* Le monde global est découpé en secteurs sur une grille macro $(X_{chunk}, Y_{chunk}) \in \mathbb{Z}^2$.
* La seed d'un secteur est dérivée déterministement :
  $$\text{Seed}(X, Y) = \text{Hash32}(\text{GlobalSeed} \oplus (X \times 73856093) \oplus (Y \times 19349663))$$

### `[SPEC-TRN-002]` Boundary Border Stitching
* Lorsqu'un joueur termine une carte en sortant par la bordure **Est** en $(53, y)$ :
  * La carte suivante générée est le secteur adjacent $(X+1, Y)$.
  * La bordure **Ouest** $(0, y)$ de la nouvelle carte hérite strictement des altitudes $h(53, y)$ et des états de rivière de la carte précédente.
  * Une fonction de transition d'Hermite $S(t) = 3t^2 - 2t^3$ applique un fondu sur une marge de 5 colonnes ($x \in [0, 4]$) pour garantir la continuité géologique absolue.

### `[SPEC-TRN-003]` Exit-to-Entry Spawn Handoff
* Lorsque le héros franchit la sortie $(53, y_{exit})$ d'une carte :
  * Sur la carte suivante $(X+1, Y)$, le point d'apparition initial du héros est automatiquement fixé à $(1, y_{exit})$.
  * Le biome dominant et l'altitude locale sont conservés à l'identique pour assurer une fluidité narrative et sensorielle parfaite.

---

## 10. 3D Rendering & Visual Styling (`SPEC-RND`)

### `[SPEC-RND-001]` Diorama Cutout & Geological Slice
* La carte 3D est rendue comme un diorama flottant dans le vide.
* Les 4 bordures extérieures descendent verticalement vers un socle de roche profonde sombre, donnant l'effet d'une maquette de terrain de jeu taillée dans la roche.

### `[SPEC-RND-002]` Zelda BotW / Warcraft III Palette
* **Shading** : Toon/Cel-shading avec rampe de luminance à 3 niveaux discrets (Ombre, Neutre, Haute lumière).
* **Color Schemes** :
  * Plaines : Vert prairie vif `#5fa338`, chemins terre battue `#c29b62`.
  * Eau : Turquoise cristalline `#2ab5b5` avec ligne d'écume blanche en bordure.
  * Roche / Falaise : Gris ardoise chaleureux `#6d6978` avec arêtes claires.
  * Végétation : Arbres volumétriques stylisés low-poly avec feuillage touffu et dégradé zénithal.

### `[SPEC-RND-004]` Terraced Stepped Plateaus vs Continuous Relief
* Le moteur de rendu supporte deux modes d'extrusion du relief :
  1. **Mode Organique (BotW)** : Maillage triangulé lissé où l'altitude $Y = h(x, y) \cdot \text{heightScale}$ forme des collines douces et des pentes continues.
  2. **Mode Terrasses (Warcraft III / HeroQuest Tabletop)** : Discrétisation en $K$ paliers horizontaux ($K \in [4, 12]$) reliés par des falaises verticales ou biseautées, donnant l'impression de dalles de jeu superposées.

