import {
  id,
  TemplatePath,
  ScenePath,
  InstancePath,
  ElementPath,
  StaticInstancePath,
  StaticElementPath,
  StaticTemplatePath,
  StaticScenePath,
} from './project-file-types'
import { arrayEquals, longestCommonArray, identity, fastForEach } from './utils'
import { replaceAll } from './string-utils'
import { last, dropLastN, drop, splitAt, flattenArray, dropLast } from './array-utils'
import { extractOriginalUidFromIndexedUid } from './uid-utils'
import { forceNotNull } from './optional-utils'

// KILLME, except in 28 places
export const toComponentId = toString

// Probably KILLME too
export function toVarSafeComponentId(path: TemplatePath): string {
  const asStr = toString(path)
  return replaceAll(asStr, '-', '_')
}

interface ScenePathCache {
  cached: ScenePath | null
  cachedToString: string | null
  childSceneCaches: { [key: string]: ScenePathCache }
  childInstanceCaches: { [key: string]: InstancePathCache }
}

interface InstancePathCache {
  cached: InstancePath | null
  cachedToString: string | null
  childInstanceCaches: { [key: string]: InstancePathCache }
}

function emptyScenePathCache(): ScenePathCache {
  return {
    cached: null,
    cachedToString: null,
    childSceneCaches: {},
    childInstanceCaches: {},
  }
}

function emptyInstancePathCache(): InstancePathCache {
  return {
    cached: null,
    cachedToString: null,
    childInstanceCaches: {},
  }
}

let globalPathStringToPathCache: { [key: string]: TemplatePath } = {}
let globalScenePathCache: ScenePathCache = emptyScenePathCache()

export function clearTemplatePathCache() {
  globalPathStringToPathCache = {}
  globalScenePathCache = emptyScenePathCache()
}

function getScenePathCache(sceneElementPaths: ElementPath[]): ScenePathCache {
  let joinedPaths: string[] = []
  const length = sceneElementPaths.length
  fastForEach(sceneElementPaths, (path, index) => {
    joinedPaths.push(...path)
    if (index < length - 1) {
      joinedPaths.push(SceneSeparator)
    }
  })

  let workingPathCache: ScenePathCache = globalScenePathCache
  fastForEach(joinedPaths, (pathPart) => {
    if (workingPathCache.childSceneCaches[pathPart] == null) {
      const newCache = emptyScenePathCache()
      workingPathCache.childSceneCaches[pathPart] = newCache
      workingPathCache = newCache
    } else {
      workingPathCache = workingPathCache.childSceneCaches[pathPart]
    }
  })
  return workingPathCache
}

function getScenePathCacheForScenePath(scene: ScenePath): ScenePathCache {
  return getScenePathCache(scene.sceneElementPaths)
}

function getInstancePathCacheFromScenePathCache(
  elementPath: ElementPath,
  startingPoint: ScenePathCache,
): InstancePathCache {
  let workingPathCache: InstancePathCache = emptyInstancePathCache()
  fastForEach(elementPath, (pathPart, index) => {
    const cacheToReadFrom =
      index === 0 ? startingPoint.childInstanceCaches : workingPathCache.childInstanceCaches

    if (cacheToReadFrom[pathPart] == null) {
      const newCache = emptyInstancePathCache()
      cacheToReadFrom[pathPart] = newCache
      workingPathCache = newCache
    } else {
      workingPathCache = cacheToReadFrom[pathPart]
    }
  })
  return workingPathCache
}

function getInstancePathCache(scene: ScenePath, elementPath: ElementPath): InstancePathCache {
  const scenePathCache = getScenePathCacheForScenePath(scene)
  return getInstancePathCacheFromScenePathCache(elementPath, scenePathCache)
}

const SceneSeparator = ':'
const ElementSeparator = '/'

function scenePathToString(path: ScenePath): string {
  const pathCache = getScenePathCacheForScenePath(path)
  if (pathCache.cachedToString == null) {
    const result = path.sceneElementPaths.map(elementPathToString).join(SceneSeparator)
    pathCache.cachedToString = result
    return result
  } else {
    return pathCache.cachedToString
  }
}

export function elementPathToString(path: ElementPath): string {
  let result: string = ''
  const elementsLength = path.length
  fastForEach(path, (elem, index) => {
    result += elem
    if (index < elementsLength - 1) {
      result += ElementSeparator
    }
  })
  return result
}

function instancePathToString(path: InstancePath): string {
  const pathCache = getInstancePathCache(path.scene, path.element)
  if (pathCache.cachedToString == null) {
    const result = `${scenePathToString(path.scene)}${SceneSeparator}${elementPathToString(
      path.element,
    )}`
    pathCache.cachedToString = result
    return result
  } else {
    return pathCache.cachedToString
  }
}

export function toString(target: TemplatePath): string {
  if (isScenePath(target)) {
    return scenePathToString(target)
  } else {
    return instancePathToString(target)
  }
}

function newScenePath(elementPaths: ElementPath[]): ScenePath {
  return {
    type: 'scenepath',
    sceneElementPaths: elementPaths,
  }
}

export const emptyElementPath: StaticElementPath = ([] as any) as StaticElementPath

export function staticElementPath(elements: string[]): StaticElementPath {
  return elements as StaticElementPath
}

export const emptyScenePath: StaticScenePath = {
  type: 'scenepath',
  sceneElementPaths: [],
}

function isEmptyElementPathsArray(elementPaths: ElementPath[]): boolean {
  return elementPaths.length === 0 || (elementPaths.length === 1 && elementPaths[0].length === 0)
}

function isEmptyScenePath(scene: ScenePath): boolean {
  return isEmptyElementPathsArray(scene.sceneElementPaths)
}

export function isEmptyPath(path: TemplatePath): boolean {
  if (isScenePath(path)) {
    return isEmptyScenePath(path)
  } else {
    return path.element.length === 0 && isEmptyScenePath(path.scene)
  }
}

function newInstancePath(scene: ScenePath, elementPath: ElementPath): InstancePath {
  return {
    scene: scene,
    element: elementPath,
  }
}

export const emptyInstancePath: StaticInstancePath = {
  scene: emptyScenePath,
  element: emptyElementPath,
}

export function scenePath(elementPaths: ElementPath[]): ScenePath {
  if (isEmptyElementPathsArray(elementPaths)) {
    return emptyScenePath
  }

  const pathCache = getScenePathCache(elementPaths)
  if (pathCache.cached == null) {
    const newPath = newScenePath(elementPaths)
    pathCache.cached = newPath
    return newPath
  } else {
    return pathCache.cached
  }
}

export function staticScenePath(elementPaths: StaticElementPath[]): StaticScenePath {
  return scenePath(elementPaths) as StaticScenePath
}

export function instancePath(scene: ScenePath, elementPath: ElementPath): InstancePath {
  if (scene.sceneElementPaths.length === 0 && elementPath.length === 0) {
    return emptyInstancePath
  } else {
    const pathCache = getInstancePathCache(scene, elementPath)
    if (pathCache.cached == null) {
      const newPath = newInstancePath(scene, elementPath)
      pathCache.cached = newPath
      return newPath
    } else {
      return pathCache.cached
    }
  }
}

export function staticInstancePath(
  scene: StaticScenePath,
  elementPath: StaticElementPath,
): StaticInstancePath {
  return instancePath(scene, elementPath) as StaticInstancePath
}

export function asStatic(path: InstancePath): StaticInstancePath {
  return path as StaticInstancePath
}

export function isScenePath(path: unknown): path is ScenePath {
  return (path as any)?.type === 'scenepath'
}

export function isInstancePath(path: unknown): path is InstancePath {
  return (path as any).scene != null && (path as any).element != null
}

export function isTemplatePath(path: unknown): path is TemplatePath {
  return isScenePath(path) || isInstancePath(path)
}

export function isTopLevelInstancePath(path: TemplatePath): path is InstancePath {
  return isInstancePath(path) && path.element.length === 1
}

export function isStoryboardPath(path: InstancePath): boolean {
  return isEmptyScenePath(path.scene) && isTopLevelInstancePath(path)
}

export function isStoryboardDescendant(path: TemplatePath): boolean {
  const asInstancePath = instancePathForElementAtPathDontThrowOnScene(path)
  return isEmptyScenePath(asInstancePath.scene) && !isStoryboardPath(asInstancePath)
}

export function isStoryboardChild(path: TemplatePath): boolean {
  const asInstancePath = instancePathForElementAtPathDontThrowOnScene(path)
  return isEmptyScenePath(asInstancePath.scene) && asInstancePath.element.length === 2
}

export function scenePathPartOfTemplatePath(path: TemplatePath): ScenePath {
  // Returns the `scene` part of an `InstancePath`, or if given a `ScenePath` it just returns that
  if (isScenePath(path)) {
    return path
  } else {
    return path.scene
  }
}

export function instancePathForElementAtScenePath(path: ScenePath): StaticInstancePath {
  // FIXME This should be returning a regular InstancePath, not a StaticInstancePath
  // Uses the last `ElementPath` in a `ScenePath` to create an `InstancePath` pointing to that element
  const staticScene = dynamicScenePathToStaticScenePath(path)
  const lastElementPath = last(staticScene.sceneElementPaths)
  if (lastElementPath == null) {
    return emptyInstancePath
  } else {
    const targetSceneElementPaths = dropLast(staticScene.sceneElementPaths)
    const targetScenePath = staticScenePath(targetSceneElementPaths)
    return staticInstancePath(targetScenePath, lastElementPath)
  }
}

function instancePathForElementPaths(elementPaths: ElementPath[]): InstancePath {
  const lastElementPath = last(elementPaths)
  if (lastElementPath == null) {
    return emptyInstancePath
  } else {
    const targetSceneElementPaths = dropLast(elementPaths)
    const targetScenePath = scenePath(targetSceneElementPaths)
    return instancePath(targetScenePath, lastElementPath)
  }
}

export function instancePathForElementAtPathDontThrowOnScene(path: TemplatePath): InstancePath {
  return isInstancePath(path) ? path : instancePathForElementPaths(path.sceneElementPaths)
}

export function instancePathForElementAtPath(path: TemplatePath): InstancePath {
  if (isScenePath(path)) {
    throw new Error(`Encountered Scene Path ${toString(path)}`)
  }

  return instancePathForElementAtPathDontThrowOnScene(path)
}

export function scenePathForElementAtInstancePath(path: InstancePath): ScenePath {
  // Appends the `ElementPath` part of an `InstancePath` to that instance's `ScenePath`, to create a
  // `ScenePath` pointing to that element
  return scenePath([...path.scene.sceneElementPaths, path.element])
}

export function staticScenePathForElementAtInstancePath(path: StaticInstancePath): StaticScenePath {
  return staticScenePath([...path.scene.sceneElementPaths, path.element])
}

export function scenePathForElementAtPath(path: TemplatePath): ScenePath {
  return isScenePath(path) ? path : scenePathForElementAtInstancePath(path)
}

export function elementPathForPath(path: StaticScenePath): StaticElementPath
export function elementPathForPath(path: ScenePath): ElementPath
export function elementPathForPath(path: StaticInstancePath): StaticElementPath
export function elementPathForPath(path: InstancePath): ElementPath
export function elementPathForPath(path: TemplatePath): ElementPath
export function elementPathForPath(path: TemplatePath): ElementPath {
  if (isScenePath(path)) {
    return last(path.sceneElementPaths) ?? []
  } else {
    return path.element
  }
}

export function filterScenes(paths: StaticTemplatePath[]): StaticInstancePath[]
export function filterScenes(paths: TemplatePath[]): InstancePath[]
export function filterScenes(paths: TemplatePath[]): StaticInstancePath | InstancePath[] {
  return paths.filter(isInstancePath)
}

// FIXME: This should be retired, it's just plain dangerous.
// Right now this is only used for SpecialNodes (in CanvasMetaData)
function fromStringUncached(path: string): TemplatePath {
  let elementPathStrs = path.split(SceneSeparator)
  const lastElementStr = elementPathStrs.pop()! // We know this is safe because ''.split(SceneSeparator).pop() returns ''
  let sceneStrs = elementPathStrs.length > 0 ? elementPathStrs : [lastElementStr]
  let elementStr = elementPathStrs.length > 0 ? lastElementStr : null

  const sceneElementPaths = sceneStrs.map((scene) =>
    scene.split(ElementSeparator).filter((e) => e.length > 0),
  )
  const scene = scenePath(sceneElementPaths)

  if (elementStr == null) {
    return scene
  } else {
    const element = elementStr.split(ElementSeparator)
    if (element.length > 0) {
      const filteredElement = element.filter((e) => e.length > 0)
      return instancePath(scene, filteredElement)
    } else {
      return scene
    }
  }
}

export function fromString(path: string): TemplatePath {
  let fromPathStringCache = globalPathStringToPathCache[path]
  if (fromPathStringCache == null) {
    const result = fromStringUncached(path)
    globalPathStringToPathCache[path] = result
    return result
  } else {
    return fromPathStringCache
  }
}

function allElementPaths(fullPath: ElementPath[]): Array<ElementPath[]> {
  let paths: Array<ElementPath[]> = []
  for (var index = 1; index < fullPath.length; index++) {
    const prefix: ElementPath[] = fullPath.slice(0, index)
    const suffixes = allElementPathsForPart(fullPath[index])
    fastForEach(suffixes, (suffix) => paths.push(prefix.concat(suffix)))
  }

  return paths
}

function allElementPathsForPart(path: ElementPath): Array<ElementPath> {
  let paths: Array<ElementPath> = []
  for (var size = 1; size <= path.length; size++) {
    paths.push(path.slice(0, size))
  }
  return paths
}

function allInstancePaths(path: InstancePath): Array<InstancePath> {
  const { scene } = path
  const toInstancePath = (elementPath: ElementPath) => instancePath(scene, elementPath)
  return allElementPathsForPart(path.element).map(toInstancePath)
}

export function allPaths(path: TemplatePath | null): Array<TemplatePath> {
  if (path == null) {
    return []
  } else if (isScenePath(path)) {
    throw new Error(`Unexpected Scene Path`)
  } else {
    return [instancePathForElementAtPathDontThrowOnScene(path.scene), ...allInstancePaths(path)]
  }
}

export function depth(path: TemplatePath): number {
  if (isScenePath(path)) {
    return 1 // 0 or 1?
  } else {
    return 1 + path.element.length
  }
}

export function navigatorDepth(path: TemplatePath): number {
  const elementPathParts = fullElementPathForPath(path)
  return elementPathParts.reduce((working, next) => working + next.length, -2)
}

export function isInsideFocusedComponent(path: TemplatePath): boolean {
  if (isScenePath(path)) {
    return false
  } else {
    return path.scene.sceneElementPaths.length > 1
  }
}

export function elementPathParent(path: StaticElementPath): StaticElementPath
export function elementPathParent(path: ElementPath): ElementPath
export function elementPathParent(path: ElementPath): ElementPath {
  return path.slice(0, path.length - 1)
}

export function instancePathParent(path: StaticInstancePath): ScenePath | StaticInstancePath
export function instancePathParent(path: InstancePath): TemplatePath
export function instancePathParent(path: InstancePath): TemplatePath {
  const parentElementPath = elementPathParent(path.element)
  if (parentElementPath.length === 0) {
    return path.scene
  } else {
    return instancePath(path.scene, parentElementPath)
  }
}

export function parentPath(path: ScenePath): null
export function parentPath(path: StaticInstancePath): StaticTemplatePath
export function parentPath(path: InstancePath): TemplatePath
export function parentPath(path: TemplatePath): TemplatePath | null
export function parentPath(path: TemplatePath): TemplatePath | null {
  if (isScenePath(path)) {
    return null // FIXME This is wrong!
  } else {
    return instancePathParent(path)
  }
}

export function parentTemplatePath(path: TemplatePath): TemplatePath {
  const asInstancePath = instancePathForElementAtPathDontThrowOnScene(path)
  const parent = parentPath(asInstancePath)
  return instancePathForElementAtPathDontThrowOnScene(parent)
}

export function isParentOf(maybeParent: TemplatePath, maybeChild: TemplatePath): boolean {
  const maybeChildAsInstancePath = instancePathForElementAtPathDontThrowOnScene(maybeChild)
  const maybeParentAsInstancePath = instancePathForElementAtPathDontThrowOnScene(maybeParent)
  const actualParent = instancePathForElementAtPathDontThrowOnScene(
    parentPath(maybeChildAsInstancePath),
  )
  return pathsEqual(actualParent, maybeParentAsInstancePath)
}

export function elementPathToUID(path: ElementPath): id {
  return forceNotNull('Attempting to get the UID of an empty ElementPath', last(path))
}

// KILLME DEPRECATED, use toUid instead
export function toTemplateId(path: InstancePath): id {
  return elementPathToUID(path.element)
}

function lastElementPathPart(path: TemplatePath): ElementPath {
  if (isInstancePath(path)) {
    return path.element
  } else {
    return last(path.sceneElementPaths) ?? []
  }
}

export function toUid(path: TemplatePath): id {
  const elementPathToUse = lastElementPathPart(path)
  return elementPathToUID(elementPathToUse)
}

export function toStaticUid(path: InstancePath): id {
  return extractOriginalUidFromIndexedUid(toUid(path))
}

export function allTemplateIds(path: InstancePath): Array<id> {
  return path.element
}

export function appendToElementPath(
  path: StaticElementPath,
  next: id | Array<id>,
): StaticElementPath
export function appendToElementPath(path: ElementPath, next: id | Array<id>): ElementPath
export function appendToElementPath(path: ElementPath, next: id | Array<id>): ElementPath {
  return path.concat(next)
}

export function appendNewElementPath(path: TemplatePath, next: id | ElementPath): InstancePath {
  const currentPath = fullElementPathForPath(path)
  const toAppend = Array.isArray(next) ? next : [next]
  return instancePathForElementPaths([...currentPath, toAppend])
}

export function appendToPath(path: StaticTemplatePath, next: id): StaticInstancePath
export function appendToPath(path: TemplatePath, next: id): InstancePath
export function appendToPath(path: StaticInstancePath, next: Array<id>): StaticInstancePath
export function appendToPath(path: InstancePath, next: Array<id>): InstancePath
export function appendToPath(path: StaticTemplatePath, next: Array<id>): StaticTemplatePath
export function appendToPath(path: TemplatePath, next: Array<id>): TemplatePath
export function appendToPath(path: TemplatePath, next: id | Array<id>): TemplatePath
export function appendToPath(path: TemplatePath, next: id | Array<id>): TemplatePath {
  const nextArray = Array.isArray(next) ? next : [next]
  if (nextArray.length === 0) {
    return path
  }

  if (isScenePath(path)) {
    return instancePath(path, nextArray)
  } else {
    return instancePath(path.scene, appendToElementPath(path.element, nextArray))
  }
}

export function notNullPathsEqual(l: TemplatePath, r: TemplatePath): boolean {
  return pathsEqual(l, r)
}

export function elementsEqual(l: id | null, r: id | null): boolean {
  // Keeping this function incase we make template path elements complicated again
  return l === r
}

export function scenePathsEqual(l: ScenePath, r: ScenePath): boolean {
  return l === r || fullElementPathsEqual(l.sceneElementPaths, r.sceneElementPaths)
}

function elementPathsEqual(l: ElementPath, r: ElementPath): boolean {
  if (l === r) {
    return true
  } else {
    return arrayEquals(l, r, elementsEqual)
  }
}

function fullElementPathsEqual(l: ElementPath[], r: ElementPath[]): boolean {
  return l === r || arrayEquals(l, r, elementPathsEqual)
}

function instancePathsEqual(l: InstancePath, r: InstancePath): boolean {
  return l === r || (scenePathsEqual(l.scene, r.scene) && elementPathsEqual(l.element, r.element))
}

export function pathsEqual(l: TemplatePath | null, r: TemplatePath | null): boolean {
  if (l == null) {
    return r == null
  } else if (r == null) {
    return false
  } else if (l === r) {
    return true
  } else if (isScenePath(l)) {
    return isScenePath(r) && scenePathsEqual(l, r)
  } else if (isScenePath(r)) {
    return false
  } else {
    return instancePathsEqual(l, r)
  }
}

export function containsPath(path: TemplatePath | null, paths: Array<TemplatePath>): boolean {
  const matchesPath = (p: TemplatePath) => pathsEqual(path, p)
  return paths.some(matchesPath)
}

export function filterPaths(paths: TemplatePath[], pathsToFilter: TemplatePath[]): TemplatePath[] {
  return paths.filter((path) => !containsPath(path, pathsToFilter))
}

export function addPathIfMissing(
  path: TemplatePath,
  paths: Array<TemplatePath>,
): Array<TemplatePath> {
  if (containsPath(path, paths)) {
    return paths
  } else {
    return paths.concat(path)
  }
}

export function addPathsIfMissing(
  existingPaths: Array<InstancePath>,
  pathsToAdd: Array<InstancePath>,
): Array<InstancePath>
export function addPathsIfMissing(
  existingPaths: Array<ScenePath>,
  pathsToAdd: Array<ScenePath>,
): Array<ScenePath>
export function addPathsIfMissing(
  existingPaths: Array<TemplatePath>,
  pathsToAdd: Array<TemplatePath>,
): Array<TemplatePath>
export function addPathsIfMissing(
  existingPaths: Array<TemplatePath>,
  pathsToAdd: Array<TemplatePath>,
): Array<TemplatePath> {
  if (pathsToAdd.length === 0) {
    return existingPaths
  } else if (existingPaths.length === 0) {
    return pathsToAdd
  } else {
    return existingPaths.concat(filterPaths(pathsToAdd, existingPaths))
  }
}

export function isChildOf(path: TemplatePath | null, parent: TemplatePath | null): boolean {
  if (path == null || parent == null) {
    return false
  } else {
    return pathsEqual(parentPath(path), parent)
  }
}

export function isSiblingOf(l: TemplatePath | null, r: TemplatePath | null): boolean {
  return l != null && r != null && pathsEqual(parentPath(l), parentPath(r))
}

function slicedPathsEqual(l: ElementPath, r: ElementPath): boolean {
  const slicedL = l.slice(0, r.length)
  return elementPathsEqual(slicedL, r)
}

function elementIsDescendant(l: ElementPath, r: ElementPath): boolean {
  return l.length > r.length && slicedPathsEqual(l, r)
}

function elementIsDescendantOrEqualTo(l: ElementPath, r: ElementPath): boolean {
  return l.length >= r.length && slicedPathsEqual(l, r)
}

function scenePathIsDescendent(path: ScenePath, targetAncestor: ScenePath): boolean {
  return targetAncestor.sceneElementPaths.every((elementPath, i) => {
    if (path.sceneElementPaths[i] != null) {
      return elementPathsEqual(elementPath, path.sceneElementPaths[i])
    } else {
      return false
    }
  })
}

// This is sooooo badly named! It should be `isDescendentOf`, and tbh that was probably me...
// e.g. isAncestorOf(instancePath(['A'], ['B', 'C']), instancePath(['A'], ['B']) would return true,
//      isAncestorOf(instancePath(['A'], ['B']), instancePath(['A'], ['B', 'C']) would return false
export function isAncestorOf(
  path: TemplatePath,
  targetAncestor: TemplatePath,
  includePathsEqual: boolean = true,
): boolean {
  if (pathsEqual(targetAncestor, path)) {
    return includePathsEqual
  } else if (isScenePath(path)) {
    // we've already tested the case where they equals, and a scene can't be a descendent
    return false
  } else if (isScenePath(targetAncestor)) {
    return scenePathIsDescendent(path.scene, targetAncestor)
  } else {
    const elementPathCompare = includePathsEqual
      ? elementIsDescendantOrEqualTo
      : elementIsDescendant

    return (
      scenePathIsDescendent(path.scene, targetAncestor.scene) &&
      elementPathCompare(path.element, targetAncestor.element)
    )
  }
}

function fullElementPathForPath(path: TemplatePath): ElementPath[] {
  if (isScenePath(path)) {
    return path.sceneElementPaths
  } else {
    return [...path.scene.sceneElementPaths, path.element]
  }
}

export function isDescendantOf(target: TemplatePath, maybeAncestor: TemplatePath): boolean {
  const targetElementPath = fullElementPathForPath(target)
  const maybeAncestorElementPath = fullElementPathForPath(maybeAncestor)
  if (targetElementPath.length >= maybeAncestorElementPath.length) {
    const partsToCheck = targetElementPath.slice(0, maybeAncestorElementPath.length)
    return partsToCheck.every((elementPath, i) => {
      // all parts up to the last must match, and the last must be a descendant
      if (i < maybeAncestorElementPath.length - 1) {
        return elementPathsEqual(elementPath, maybeAncestorElementPath[i])
      } else {
        const finalPartComparison =
          targetElementPath.length === maybeAncestorElementPath.length
            ? elementIsDescendant
            : elementIsDescendantOrEqualTo

        return finalPartComparison(elementPath, maybeAncestorElementPath[i])
      }
    })
  } else {
    return false
  }
}

export function getAncestors(path: TemplatePath): TemplatePath[] {
  return allPaths(path).slice(0, -1)
}

function dropFromScene(path: ScenePath, n: number): TemplatePath | null {
  return n >= 1 ? null : path
}

function dropFromInstance(path: InstancePath, n: number): TemplatePath | null {
  const elementLength = path.element.length
  if (elementLength > n) {
    return instancePath(path.scene, dropLastN(n, path.element))
  } else {
    const remaining = elementLength - n
    return dropFromScene(path.scene, remaining)
  }
}

function dropFromPath(path: TemplatePath, n: number): TemplatePath | null {
  if (isScenePath(path)) {
    return dropFromScene(path, n)
  } else {
    return dropFromInstance(path, n)
  }
}

export const getNthParent = dropFromPath

export function replaceIfAncestor(
  path: ScenePath,
  replaceSearch: TemplatePath,
  replaceWith: TemplatePath | null,
): null
export function replaceIfAncestor(
  path: TemplatePath,
  replaceSearch: TemplatePath,
  replaceWith: null,
): null
export function replaceIfAncestor(
  path: InstancePath,
  replaceSearch: TemplatePath,
  replaceWith: InstancePath | null,
): InstancePath
export function replaceIfAncestor(
  path: TemplatePath,
  replaceSearch: TemplatePath,
  replaceWith: TemplatePath | null,
): TemplatePath | null
export function replaceIfAncestor(
  path: TemplatePath,
  replaceSearch: TemplatePath,
  replaceWith: TemplatePath | null,
): TemplatePath | null {
  // A/B/C -> A/B -> G/H -> G/H/C
  if (isScenePath(path)) {
    return null
  }
  if (replaceWith == null) {
    // TODO Scene Implementation
    return null
  }

  if (isAncestorOf(path, replaceSearch, true)) {
    let segmentToMove: Array<id>
    if (isScenePath(replaceSearch)) {
      segmentToMove = path.element
    } else {
      segmentToMove = drop(replaceSearch.element.length, path.element)
    }
    return appendToPath(replaceWith, segmentToMove)
  } else {
    return null
  }
}

export function replaceOrDefault(
  path: ScenePath,
  replaceSearch: TemplatePath,
  replaceWith: TemplatePath | null,
): ScenePath
export function replaceOrDefault(
  path: InstancePath,
  replaceSearch: TemplatePath,
  replaceWith: TemplatePath | null,
): InstancePath
export function replaceOrDefault(
  path: TemplatePath,
  replaceSearch: TemplatePath,
  replaceWith: TemplatePath | null,
): TemplatePath
export function replaceOrDefault(
  path: TemplatePath,
  replaceSearch: TemplatePath,
  replaceWith: TemplatePath | null,
): TemplatePath {
  const ifAncestor = replaceIfAncestor(path, replaceSearch, replaceWith)
  if (ifAncestor == null) {
    return path
  } else {
    return ifAncestor
  }
}

export function rootId(path: InstancePath): string {
  return path.element[0]
}

export function isValidTemplatePath(path: any): path is TemplatePath {
  return isScenePath(path) || isInstancePath(path)
}

export function closestSharedAncestor(
  l: TemplatePath | null,
  r: TemplatePath | null,
  includePathsEqual: boolean,
): TemplatePath | null {
  const toTargetPath: (p: TemplatePath) => TemplatePath | null = includePathsEqual
    ? identity
    : parentPath

  const lTarget = l == null ? null : toTargetPath(l)
  const rTarget = r == null ? null : toTargetPath(r)

  if (l === null || r === null || lTarget == null || rTarget == null) {
    return null
  } else if (l === r) {
    return toTargetPath(l)
  } else {
    const lScene = scenePathPartOfTemplatePath(lTarget)
    const rScene = scenePathPartOfTemplatePath(rTarget)
    const scenesEqual = scenePathsEqual(lScene, rScene)
    if (scenesEqual) {
      if (isScenePath(lTarget) || isScenePath(rTarget)) {
        return lScene
      } else {
        const matchedElements = longestCommonArray(lTarget.element, rTarget.element)
        if (matchedElements.length > 0) {
          return instancePath(lScene, matchedElements)
        } else {
          return lScene
        }
      }
    } else {
      return null
    }
  }
}

export function getCommonParent(
  paths: Array<TemplatePath>,
  includeSelf: boolean = false,
): TemplatePath | null {
  if (paths.length === 0) {
    return null
  } else {
    const parents = includeSelf ? paths : paths.map(parentPath)
    return parents.reduce((l, r) => closestSharedAncestor(l, r, true), parents[0])
  }
}

export interface ElementsTransformResult<T> {
  elements: Array<T>
  transformedElement: T | null
}

export function findAndTransformAtPath<T>(
  elements: Array<T>,
  path: ElementPath,
  getChildren: (t: T) => Array<T> | null,
  getElementID: (element: T) => string,
  transform: (t: T) => T,
): ElementsTransformResult<T> {
  let transformedElement: T | null = null

  function findAndTransformAtPathInner(element: T, workingPath: string[]): T {
    if (transformedElement != null) {
      return element
    }

    const [firstUIDOrIndex, ...tailPath] = workingPath
    if (getElementID(element) === firstUIDOrIndex) {
      // transform
      if (tailPath.length === 0) {
        // this is the element we want to transform
        transformedElement = transform(element)
        return transformedElement
      } else {
        // we will want to transform one of our children
        let childrenChanged: boolean = false
        let transformedChildren: Array<T> = []
        const children = getChildren(element)
        if (children != null) {
          fastForEach(children, (child) => {
            const transformedChild = findAndTransformAtPathInner(child, tailPath)
            if (transformedChild == child) {
              transformedChildren.push(child)
            } else {
              childrenChanged = true
              transformedChildren.push(transformedChild)
            }
          })
        }
        if (childrenChanged && children != null) {
          return {
            ...element,
            children: transformedChildren,
          }
        } else {
          // we had a NO_OP transform result, let's keep reference equality
          return element
        }
      }
    } else {
      // this is not the branch we are looking for
      return element
    }
  }

  const transformedElements = elements.map((element) => {
    if (transformedElement == null) {
      return findAndTransformAtPathInner(element, path)
    } else {
      return element
    }
  })

  return {
    elements: transformedElements,
    transformedElement: transformedElement,
  }
}

export function transformAtPath<T>(
  elements: Array<T>,
  path: ElementPath,
  getChildren: (t: T) => Array<T> | null,
  getElementID: (element: T) => string,
  transform: (t: T) => T,
): Array<T> {
  const transformResult = findAndTransformAtPath(
    elements,
    path,
    getChildren,
    getElementID,
    transform,
  )
  if (transformResult.transformedElement == null) {
    throw new Error(`Did not find element to transform ${elementPathToString(path)}`)
  } else {
    return transformResult.elements
  }
}

export function findAtElementPath<T>(
  elements: Array<T>,
  path: ElementPath,
  getChildren: (t: T) => Array<T> | null,
  getElementID: (element: T) => string,
): T | null {
  let searchFailed: boolean = false
  let foundElement: T | null = null
  const shouldStop = () => searchFailed || foundElement != null

  function findAtPathInner(element: T, workingPath: string[]) {
    if (shouldStop()) {
      return
    }

    const firstUIDOrIndex = workingPath[0]
    if (getElementID(element) === firstUIDOrIndex) {
      // we've found the right path
      if (workingPath.length === 1) {
        foundElement = element
        return
      } else {
        const children = getChildren(element)
        if (children != null) {
          const tailPath = workingPath.slice(1)
          fastForEach(children, (child) => {
            if (shouldStop()) {
              return
            }

            findAtPathInner(child, tailPath)
          })
        }

        if (foundElement == null) {
          searchFailed = true
        }
      }
    } else {
      // this is not the branch we are looking for
      return
    }
  }

  fastForEach(elements, (element) => findAtPathInner(element, path))

  return foundElement
}

export function areAllElementsInSameScene(paths: TemplatePath[]): boolean {
  if (paths.length === 0) {
    return true
  } else {
    const firstScenePath = scenePathPartOfTemplatePath(paths[0])
    return paths.every((p) => scenePathsEqual(firstScenePath, scenePathPartOfTemplatePath(p)))
  }
}

export function isFromSameSceneAs(a: TemplatePath, b: TemplatePath): boolean {
  return scenePathsEqual(scenePathPartOfTemplatePath(a), scenePathPartOfTemplatePath(b))
}

function dynamicElementPathToStaticElementPath(element: ElementPath): StaticElementPath {
  return element.map(extractOriginalUidFromIndexedUid) as StaticElementPath
}

function dynamicScenePathToStaticScenePath(scene: ScenePath): StaticScenePath {
  return staticScenePath(scene.sceneElementPaths.map(dynamicElementPathToStaticElementPath))
}

export function dynamicPathToStaticPath(path: ScenePath): StaticScenePath
export function dynamicPathToStaticPath(path: InstancePath): StaticInstancePath
export function dynamicPathToStaticPath(path: TemplatePath): StaticTemplatePath
export function dynamicPathToStaticPath(path: TemplatePath): StaticTemplatePath {
  if (isScenePath(path)) {
    return dynamicScenePathToStaticScenePath(path)
  } else {
    return staticInstancePath(
      dynamicScenePathToStaticScenePath(path.scene),
      dynamicElementPathToStaticElementPath(path.element),
    )
  }
}

export function dynamicPathToStaticPathKeepSceneDynamic(path: InstancePath): StaticInstancePath {
  return staticInstancePath(
    path.scene as StaticScenePath, // TODO I'm cheating with the types, but this is how valid paths works now
    dynamicElementPathToStaticElementPath(path.element),
  )
}

export function pathUpToElementPath(
  fullPath: TemplatePath,
  elementPath: ElementPath,
  convertToStatic: 'dynamic-path' | 'static-path',
): TemplatePath | null {
  const fullElementPath = fullElementPathForPath(fullPath)
  const pathToUse =
    convertToStatic === 'static-path'
      ? fullElementPath.map(dynamicElementPathToStaticElementPath)
      : fullElementPath
  const foundIndex = pathToUse.findIndex((pathPart) => {
    return elementPathsEqual(pathPart, elementPath)
  })
  return foundIndex === -1
    ? null
    : instancePathForElementPaths(fullElementPath.slice(0, foundIndex + 1))
}

export function isScenePathEmpty(path: TemplatePath): boolean {
  if (isScenePath(path)) {
    return path.sceneElementPaths.length === 0
  } else {
    return path.scene.sceneElementPaths.length === 0
  }
}

interface DropFirstScenePathElementResultType {
  newPath: InstancePath | null
  droppedScenePathElements: StaticElementPath | null
}

export function dropFirstScenePathElement(
  path: StaticInstancePath | null,
): DropFirstScenePathElementResultType {
  if (path == null) {
    return {
      newPath: null,
      droppedScenePathElements: null,
    }
  } else if (isScenePathEmpty(path)) {
    return {
      newPath: path,
      droppedScenePathElements: null,
    }
  } else {
    return {
      newPath: {
        ...path,
        scene: scenePath(path.scene.sceneElementPaths.slice(1)),
      },
      droppedScenePathElements: path.scene.sceneElementPaths[0],
    }
  }
}

export function outermostScenePathPart(path: TemplatePath): ScenePath {
  const asScenePath = isScenePath(path) ? path : scenePathPartOfTemplatePath(path)
  if (asScenePath.sceneElementPaths.length > 1) {
    return {
      ...asScenePath,
      sceneElementPaths: asScenePath.sceneElementPaths.slice(0, 1),
    }
  } else {
    return asScenePath
  }
}

export function createBackwardsCompatibleScenePath(path: TemplatePath): InstancePath | null {
  const scenePathElements = isScenePath(path)
    ? path.sceneElementPaths[0]
    : path.scene.sceneElementPaths[0]
  if (scenePathElements != null) {
    return instancePath(emptyScenePath, scenePathElements.slice(0, 2)) // we only return the FIRST TWO elements (storyboard, scene), this is a horrible, horrible hack
  } else {
    return null
  }
}

export function isFocused(focusedElementPath: TemplatePath | null, path: TemplatePath): boolean {
  if (focusedElementPath == null || isStoryboardDescendant(path)) {
    return false
  } else {
    return pathUpToElementPath(focusedElementPath, elementPathForPath(path), 'dynamic-path') != null
  }
}
