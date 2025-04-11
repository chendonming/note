interface BuildTask {
  node: BVHNode;
  indices: number[];
}

/**
 * 考虑到后续可能会迁移到worker中使用，所以不使用three自带的类
 */
class Vec3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  static fromArray(array: Float32Array, offset: number): Vec3 {
    return new Vec3(array[offset], array[offset + 1], array[offset + 2]);
  }

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  add(v: Vec3): Vec3 {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v: Vec3): Vec3 {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  mul(s: number): Vec3 {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  div(s: number): Vec3 {
    return new Vec3(this.x / s, this.y / s, this.z / s);
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vec3): Vec3 {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  length(): number {
    return Math.sqrt(this.dot(this));
  }

  lengthSq(): number {
    return this.dot(this);
  }

  normalize(): Vec3 {
    const len = this.length();
    if (len === 0) return this.clone();
    return this.div(len);
  }

  distanceTo(v: Vec3): number {
    return this.sub(v).length();
  }

  distanceToSquared(v: Vec3): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }
}

/**
 * 轴对齐包围盒
 */
class AABB {
  min: Vec3;
  max: Vec3;

  constructor(min?: Vec3, max?: Vec3) {
    this.min = min || new Vec3(Infinity, Infinity, Infinity);
    this.max = max || new Vec3(-Infinity, -Infinity, -Infinity);
  }

  static fromPoints(points: Vec3[]): AABB {
    const aabb = new AABB();
    for (const p of points) {
      aabb.expandByPoint(p);
    }
    return aabb;
  }

  /**
   * 从胶囊体构建
   */
  static fromCapsule(capsule: Capsule) {
    const { start, end, radius } = capsule;
    const aabb = new AABB();
    aabb.expandByPoint(start.add(new Vec3(radius, radius, radius)));
    aabb.expandByPoint(start.sub(new Vec3(radius, radius, radius)));
    aabb.expandByPoint(end.add(new Vec3(radius, radius, radius)));
    aabb.expandByPoint(end.sub(new Vec3(radius, radius, radius)));
    return aabb;
  }

  clone(): AABB {
    return new AABB(this.min.clone(), this.max.clone());
  }

  expandByPoint(point: Vec3): AABB {
    this.min.x = Math.min(this.min.x, point.x);
    this.min.y = Math.min(this.min.y, point.y);
    this.min.z = Math.min(this.min.z, point.z);
    this.max.x = Math.max(this.max.x, point.x);
    this.max.y = Math.max(this.max.y, point.y);
    this.max.z = Math.max(this.max.z, point.z);
    return this;
  }

  expandByAABB(aabb: AABB): AABB {
    this.expandByPoint(aabb.min);
    this.expandByPoint(aabb.max);
    return this;
  }

  getCenter(): Vec3 {
    return this.min.add(this.max).div(2);
  }

  getSize(): Vec3 {
    return this.max.sub(this.min);
  }

  getSurfaceArea(): number {
    const size = this.getSize();
    return 2 * (size.x * size.y + size.y * size.z + size.z * size.x);
  }

  getVolume(): number {
    const size = this.getSize();
    return size.x * size.y * size.z;
  }

  getLongestAxis(): number {
    const size = this.getSize();
    if (size.x > size.y && size.x > size.z) return 0;
    if (size.y > size.z) return 1;
    return 2;
  }

  intersectsAABB(aabb: AABB): boolean {
    return (
      this.min.x <= aabb.max.x &&
      this.max.x >= aabb.min.x &&
      this.min.y <= aabb.max.y &&
      this.max.y >= aabb.min.y &&
      this.min.z <= aabb.max.z &&
      this.max.z >= aabb.min.z
    );
  }

  containsPoint(point: Vec3): boolean {
    return (
      point.x >= this.min.x &&
      point.x <= this.max.x &&
      point.y >= this.min.y &&
      point.y <= this.max.y &&
      point.z >= this.min.z &&
      point.z <= this.max.z
    );
  }
}

/**
 * 三角形
 */
class Triangle {
  constructor(
    public a: Vec3,
    public b: Vec3,
    public c: Vec3,
    public index: number
  ) {}

  getAABB(): AABB {
    return AABB.fromPoints([this.a, this.b, this.c]);
  }

  getNormal(): Vec3 {
    const ab = this.b.sub(this.a);
    const ac = this.c.sub(this.a);
    return ab.cross(ac).normalize();
  }

  getArea(): number {
    const ab = this.b.sub(this.a);
    const ac = this.c.sub(this.a);
    return ab.cross(ac).length() * 0.5;
  }

  getCentroid(): Vec3 {
    return this.a.add(this.b).add(this.c).div(3);
  }
}

/**
 * 胶囊体
 */
class Capsule {
  constructor(public start: Vec3, public end: Vec3, public radius: number) {}
}

/**
 * BVH节点
 */
class BVHNode {
  aabb: AABB;
  left: BVHNode | null = null;
  right: BVHNode | null = null;
  triangleIndices: number[] = [];
  isLeaf: boolean = false;

  constructor(aabb?: AABB) {
    this.aabb = aabb || new AABB();
  }
}

class BVH {
  root: BVHNode | null = null;
  triangles: Triangle[] = [];
  maxTrianglesPerLeaf: number;

  constructor(
    positions: Float32Array,
    indices: Uint32Array,
    maxTrianglesPerLeaf: number = 10
  ) {
    this.maxTrianglesPerLeaf = maxTrianglesPerLeaf;
    this.buildTriangles(positions, indices);
    this.build();
  }

  /**
   * 从顶点和索引数据构建三角形数组
   */
  private buildTriangles(positions: Float32Array, indices: Uint32Array): void {
    this.triangles = [];
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;

      const a = Vec3.fromArray(positions, i0);
      const b = Vec3.fromArray(positions, i1);
      const c = Vec3.fromArray(positions, i2);

      this.triangles.push(new Triangle(a, b, c, i / 3));
    }
  }

  /**
   * 构建BVH
   */
  private build(): void {
    if (this.triangles.length === 0) {
      this.root = null;
      return;
    }

    // 创建三角形索引数组
    const triangleIndices = this.triangles.map((_, i) => i);

    // 创建根节点
    this.root = new BVHNode();

    // 计算根节点的AABB
    const rootAABB = new AABB();
    for (const index of triangleIndices) {
      rootAABB.expandByAABB(this.triangles[index].getAABB());
    }
    this.root.aabb = rootAABB;

    const stack: BuildTask[] = [];
    stack.push({ node: this.root, indices: triangleIndices });

    while (stack.length > 0) {
      const { node, indices } = stack.pop()!;

      // 如果三角形数量小于阈值，创建叶子节点
      if (indices.length <= this.maxTrianglesPerLeaf) {
        node.isLeaf = true;
        node.triangleIndices = indices;
        continue;
      }

      // 使用SAH找到最佳分割
      const bestSplit = this.findBestSplitSAH(indices, node.aabb);

      // 如果无法找到好的分割，创建叶子节点
      if (!bestSplit) {
        node.isLeaf = true;
        node.triangleIndices = indices;
        continue;
      }

      // 创建左子节点
      node.left = new BVHNode();
      const leftAABB = new AABB();
      for (const index of bestSplit.leftIndices) {
        leftAABB.expandByAABB(this.triangles[index].getAABB());
      }
      node.left.aabb = leftAABB;

      // 创建右子节点
      node.right = new BVHNode();
      const rightAABB = new AABB();
      for (const index of bestSplit.rightIndices) {
        rightAABB.expandByAABB(this.triangles[index].getAABB());
      }
      node.right.aabb = rightAABB;

      // 将子节点任务添加到栈中
      stack.push({ node: node.right, indices: bestSplit.rightIndices });
      stack.push({ node: node.left, indices: bestSplit.leftIndices });
    }
  }

  /**
   * 使用SAH找到最佳分割
   */
  private findBestSplitSAH(
    triangleIndices: number[],
    nodeAABB: AABB
  ): {
    leftIndices: number[];
    rightIndices: number[];
  } | null {
    const numTriangles = triangleIndices.length;
    const parentArea = nodeAABB.getSurfaceArea();

    let bestCost = Infinity;
    let bestAxis = -1;
    let bestSplitIndex = -1;

    // 尝试每个轴的分割
    for (let axis = 0; axis < 3; axis++) {
      // 按照三角形中心点在当前轴上的坐标排序
      const sortedIndices = [...triangleIndices].sort((a, b) => {
        const centroidA = this.triangles[a].getCentroid();
        const centroidB = this.triangles[b].getCentroid();
        return axis === 0
          ? centroidA.x - centroidB.x
          : axis === 1
          ? centroidA.y - centroidB.y
          : centroidA.z - centroidB.z;
      });

      // 从左到右扫描，计算左侧AABB
      const leftAABBs: AABB[] = [];
      let leftAABB = new AABB();

      for (let i = 0; i < numTriangles - 1; i++) {
        leftAABB.expandByAABB(this.triangles[sortedIndices[i]].getAABB());
        leftAABBs.push(leftAABB.clone());
      }

      // 从右到左扫描，计算右侧AABB和SAH成本
      let rightAABB = new AABB();

      for (let i = numTriangles - 1; i > 0; i--) {
        rightAABB.expandByAABB(this.triangles[sortedIndices[i]].getAABB());

        const leftCount = i;
        const rightCount = numTriangles - i;

        const leftArea = leftAABBs[i - 1].getSurfaceArea();
        const rightArea = rightAABB.getSurfaceArea();

        // 计算SAH成本
        const cost =
          1 + (leftCount * leftArea + rightCount * rightArea) / parentArea;

        if (cost < bestCost) {
          bestCost = cost;
          bestAxis = axis;
          bestSplitIndex = i;
        }
      }
    }

    // 如果分割不会改善性能，返回null
    if (bestCost >= numTriangles) {
      return null;
    }

    // 根据最佳分割创建左右子集
    const sortedIndices = [...triangleIndices].sort((a, b) => {
      const centroidA = this.triangles[a].getCentroid();
      const centroidB = this.triangles[b].getCentroid();
      return bestAxis === 0
        ? centroidA.x - centroidB.x
        : bestAxis === 1
        ? centroidA.y - centroidB.y
        : centroidA.z - centroidB.z;
    });

    return {
      leftIndices: sortedIndices.slice(0, bestSplitIndex),
      rightIndices: sortedIndices.slice(bestSplitIndex),
    };
  }

  /**
   * 检测胶囊体与BVH节点的碰撞
   */
  intersectCapsule(
    capsule: Capsule,
    playerVelocity?: Vec3
  ): {
    collision: boolean;
    point?: Vec3;
    normal?: Vec3;
    depth?: number; // 改为depth以匹配原函数
  } {
    if (!this.root) {
      return { collision: false };
    }

    const result = {
      collision: false,
      point: new Vec3(),
      normal: new Vec3(),
      depth: 0,
    };

    // 使用栈来模拟递归
    const stack: BVHNode[] = [];
    stack.push(this.root);

    // 获取胶囊体的AABB
    const capsuleAABB = AABB.fromCapsule(capsule);

    while (stack.length > 0) {
      const node = stack.pop()!;

      // 首先检查胶囊体的AABB是否与节点的AABB相交
      if (!capsuleAABB.intersectsAABB(node.aabb)) {
        continue;
      }

      // 如果是叶子节点，检查与所有三角形的碰撞
      if (node.isLeaf) {
        for (const triangleIndex of node.triangleIndices) {
          const triangle = this.triangles[triangleIndex];

          // 使用改进的胶囊体-三角形碰撞检测
          const collision = this.capsuleTriangleIntersection(
            capsule,
            triangle,
            playerVelocity
          );

          if (
            collision.collision &&
            (!result.collision || collision.depth > result.depth)
          ) {
            result.collision = true;
            result.point = collision.point;
            result.normal = collision.normal;
            result.depth = collision.depth;
          }
        }
        continue;
      }

      // 如果不是叶子节点，将子节点添加到栈中
      if (node.left) stack.push(node.left);
      if (node.right) stack.push(node.right);
    }

    return result;
  }

  /**
   * 判断点是否在三角形内
   */
  pointInTriangle(p: Vec3, triangle: Triangle): boolean {
    const a = triangle.a;
    const b = triangle.b;
    const c = triangle.c;

    // 计算重心坐标
    const v0 = c.sub(a);
    const v1 = b.sub(a);
    const v2 = p.sub(a);

    const dot00 = v0.dot(v0);
    const dot01 = v0.dot(v1);
    const dot02 = v0.dot(v2);
    const dot11 = v1.dot(v1);
    const dot12 = v1.dot(v2);

    // 计算重心坐标
    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    // 检查重心坐标是否在三角形内
    return u >= 0 && v >= 0 && u + v <= 1;
  }

  /**
   * 计算两条线段的最近点
   * @param line1Start
   * @param line1End
   * @param line2Start
   * @param line2End
   * @returns
   */
  private closestPointsBetweenLines(
    line1Start: Vec3,
    line1End: Vec3,
    line2Start: Vec3,
    line2End: Vec3
  ): { point1: Vec3; point2: Vec3 } {
    const u = line1End.sub(line1Start);
    const v = line2End.sub(line2Start);
    const w = line1Start.sub(line2Start);

    const a = u.dot(u);
    const b = u.dot(v);
    const c = v.dot(v);
    const d = u.dot(w);
    const e = v.dot(w);

    const D = a * c - b * b;
    let sc, tc;

    // 如果线段几乎平行
    if (D < 1e-8) {
      sc = 0;
      tc = b > c ? d / b : e / c;
    } else {
      sc = (b * e - c * d) / D;
      tc = (a * e - b * d) / D;
    }

    // 限制参数在[0,1]范围内
    sc = Math.max(0, Math.min(1, sc));

    // 重新计算tc，考虑sc的限制
    tc = b * sc + e;
    if (tc > 0) {
      tc = tc / c;
      tc = Math.max(0, Math.min(1, tc));
    } else {
      tc = 0;
    }

    // 计算最近点
    const point1 = line1Start.add(u.mul(sc));
    const point2 = line2Start.add(v.mul(tc));

    return { point1, point2 };
  }

  // 计算胶囊体与三角形的碰撞
  private capsuleTriangleIntersection(
    capsule: Capsule,
    triangle: Triangle,
    playerVelocity?: Vec3
  ): {
    collision: boolean;
    point: Vec3;
    normal: Vec3;
    depth: number;
  } {
    // 获取三角形平面
    const normal = triangle.getNormal();
    const constant = -normal.dot(triangle.a);

    // 创建平面对象
    const plane = {
      normal: normal,
      constant: constant,
      distanceToPoint: (p: Vec3) => plane.normal.dot(p) + plane.constant,
      negate: () => {
        plane.normal = plane.normal.mul(-1);
        plane.constant = -plane.constant;
      },
    };

    // 如果提供了玩家速度，根据速度方向可能翻转平面法线
    if (playerVelocity && plane.normal.dot(playerVelocity) > 0) {
      plane.negate();
    }

    // 计算胶囊体两端点到平面的距离（减去半径）
    const d1 = plane.distanceToPoint(capsule.start) - capsule.radius;
    const d2 = plane.distanceToPoint(capsule.end) - capsule.radius;

    // 快速剔除测试
    if ((d1 > 0 && d2 > 0) || (d1 < -capsule.radius && d2 < -capsule.radius)) {
      return {
        collision: false,
        point: new Vec3(),
        normal: new Vec3(),
        depth: 0,
      };
    }

    // 计算胶囊体轴线与平面的交点
    const delta = Math.abs(d1) / (Math.abs(d1) + Math.abs(d2));
    const intersectPoint = capsule.start
      .clone()
      .add(capsule.end.clone().sub(capsule.start).mul(delta));

    // 检查交点是否在三角形内
    if (this.pointInTriangle(intersectPoint, triangle)) {
      return {
        collision: true,
        point: intersectPoint.clone(),
        normal: plane.normal.clone(),
        depth: Math.abs(Math.min(d1, d2)),
      };
    }

    // 如果交点不在三角形内，检查胶囊体与三角形边的最近点距离
    const r2 = capsule.radius * capsule.radius;

    // 检查三角形的三条边
    const edges = [
      [triangle.a, triangle.b],
      [triangle.b, triangle.c],
      [triangle.c, triangle.a],
    ];

    for (const [start, end] of edges) {
      const closestPoints = this.closestPointsBetweenLines(
        capsule.start,
        capsule.end,
        start,
        end
      );

      const point1 = closestPoints.point1;
      const point2 = closestPoints.point2;

      if (point1.distanceToSquared(point2) < r2) {
        const normal = point1.sub(point2).normalize();
        return {
          collision: true,
          point: point2.clone(),
          normal: normal,
          depth: capsule.radius - point1.distanceTo(point2),
        };
      }
    }

    // 检查胶囊体端点与三角形顶点的距离
    const vertices = [triangle.a, triangle.b, triangle.c];
    for (const vertex of vertices) {
      const distToStart = vertex.distanceToSquared(capsule.start);
      const distToEnd = vertex.distanceToSquared(capsule.end);

      if (distToStart < r2) {
        const normal = capsule.start.sub(vertex).normalize();
        return {
          collision: true,
          point: vertex.clone(),
          normal: normal,
          depth: capsule.radius - Math.sqrt(distToStart),
        };
      }

      if (distToEnd < r2) {
        const normal = capsule.end.sub(vertex).normalize();
        return {
          collision: true,
          point: vertex.clone(),
          normal: normal,
          depth: capsule.radius - Math.sqrt(distToEnd),
        };
      }
    }

    return {
      collision: false,
      point: new Vec3(),
      normal: new Vec3(),
      depth: 0,
    };
  }

  // 计算点到三角形的最近点
  private closestPointOnTriangle(p: Vec3, triangle: Triangle): Vec3 {
    const ab = triangle.b.sub(triangle.a);
    const ac = triangle.c.sub(triangle.a);
    const ap = p.sub(triangle.a);

    const d1 = ab.dot(ap);
    const d2 = ac.dot(ap);

    // 点在三角形外部区域
    if (d1 <= 0 && d2 <= 0) {
      return triangle.a.clone();
    }

    const bp = p.sub(triangle.b);
    const d3 = ab.dot(bp);
    const d4 = ac.dot(bp);

    // 点在顶点b附近
    if (d3 >= 0 && d4 <= d3) {
      return triangle.b.clone();
    }

    // 点在边ab上
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      return triangle.a.add(ab.mul(v));
    }

    const cp = p.sub(triangle.c);
    const d5 = ab.dot(cp);
    const d6 = ac.dot(cp);

    // 点在顶点c附近
    if (d6 >= 0 && d5 <= d6) {
      return triangle.c.clone();
    }

    // 点在边ac上
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6);
      return triangle.a.add(ac.mul(w));
    }

    // 点在边bc上
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
      return triangle.b.add(triangle.c.sub(triangle.b).mul(w));
    }

    // 点在三角形内部
    const denom = 1.0 / (va + vb + vc);
    const v = vb * denom;
    const w = vc * denom;

    // 计算重心坐标插值得到的点
    return triangle.a.add(ab.mul(v)).add(ac.mul(w));
  }
}

export { Vec3, AABB, Triangle, Capsule, BVH, BVHNode };
