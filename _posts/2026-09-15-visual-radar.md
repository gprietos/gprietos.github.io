---
title: "Visual Radar"
date: 2026-09-15
categories: [Practical Projects]
tags: [Practical, Visual Radar]
math: true
description: "Fusing real-time object detection, monocular depth estimation and inertial data to turn a single camera feed into a low-cost situational-awareness radar."
---


# Overview

Modern autonomous vehicles and ground operations depend on knowing exactly what surrounds them, but traditional sensors like LiDAR and traditional radar come with steep tradeoffs: high costs, complex setups, and active energy signals that give away a platform's position. On the other hand, standard cameras are lightweight, inexpensive, and low-power, yet they inherently collapse our 3D world into flat 2D images, losing critical distance information.

The **Visual Radar** bridges this gap. By pairing real-time object detection and monocular metric depth estimation with fundamental camera geometry and inertial sensor tracking, this system reconstructs the 3D position of surrounding targets solely from a standard video feed. The result is a dynamic, top-down radar map that delivers rich situational awareness without the heavy operational drawbacks or price of traditional specialized hardware.


VIDEO DEMO!





# Introduction

**Situational awareness** is the ability to understand an environment by perceiving its present elements,  comprehending their behaviour and predicting their near future status. It is a foundamental requirement for modern ground operation and automous vehicles and robotics, as these systems need to know precisely what surrounds them and where those target objects are relative to their own position at any given moment.

In practice, situational awareness is commonly achieved through a combination of complementary sensors, each providing different information about the surrounding environment.

[LiDAR](https://en.wikipedia.org/wiki/Lidar) sensors provide accurate metric distances and detailed 3D representations of the environment, but they can get expensive, especially for hobbyist projects. They can also be relatively fragile and complex, and their performance can be affected by certain environmental conditions. [Radar](https://en.wikipedia.org/wiki/Radar) offers long-range detection and is relatively resilient to adverse weather conditions such as fog or smoke. However, it generally struggles more with target identification, as conventional radar provides less spatial and semantic detail than LiDAR or cameras.

Both LiDAR and radar are **active sensors**, meaning that they emit energy into the environment. This can be a significant drawback in applications where low observability is important, such as military or stealth operations. For example, LiDAR emits laser light that may be detectable by night-vision or optical systems, potentially revealing the presence or position of the platform.

**Cameras** on the other hand are **passive sensors**, meaning that they receive energy from the environment instead of emiting it. They are also more accesible; they are cheaper, smaller and less power-hungry (after all, nearly everyone carries one around in their smartphone these days). RGB cameras excel at capturing rich, dense and detailed visual information. Thermal cameras can be used to overcome lighting limitations, capturing radiation from the infrared spectrum rather than visible light. Nevertheless, conventional cameras project the three-dimensional world into two-dimensional image, losing depth information. Specialized hardware like stereo cameras attempts to solve this, but its effective range is still limited.

Fortunately, moden **Deep Learning** advancements applied to **Computer Vision** help to close the gap without relying on expensive hardware. **Object Detection** networks identify what is in a frame and where it sits on a 2D image plane. **Monocular Depth Estimation** netoworks predict pixel-level depth maps, which can be used to effectively recovering the 3D geometry that standard cameras lack.

That realization inspired me to build the **Visual Radar** system. By pairing real-time object detection with monocular depth estimation, the system infers the spatial positions of surrounding targets from a standard video feed. Fusing this visual intelligence with inertial measurements makes it possible to map those targets directly onto a dynamic, top-down bird's-eye view radar plot.

The goal of the Visual Radar pipeline is to generate a real-time tactical map solely from monocular image and inertial data, providing situational awareness without the high cost or operational drawbacks of specialized sensors.


# The Visual Radar Pipeline

Before diving into the detailed geometry and model choices, here is a high-level overview of the main components that make up the system:

- **Perception Engine:** Deep learning models inspect the raw camera frame, simultaneously identifying target objects, labeling what they are, and predicting a dense, real-world depth map across the entire scene.

- **Camera Ray :** Using pixel coordinates from the detected targets alongside the camera's parameters, the system unprojects flat 2D image points into 3D directional light rays shooting outward from the camera's optical center.

- **Range Calculation:** By combining the directional light ray with the predicted depth, the system calculates the true Euclidean distance range to each target.

- **Spatial Reorientation:** Motion data from an IMU (roll, pitch, and yaw) rotates those 3D camera-space rays into a fixed, real-world coordinate system so the targets stay accurate regardless of how the camera tilts or turns.

- **Polar Ground Projection:** The reoriented 3D spatial points are flattened onto the 2D ground plane, resolving each target into a precise distance and compass-aligned bearing relative to the camera's position.

- **Tactical Radar Display:** Computed distances and bearings are drawn onto a polar display, resulting in a top-down view complete with class-colored target points and relevant visual information.



IMAGEN ESQUEMA PIPELINE!


```
┌──────────────────────────────────────────────────────────┐   ┌────────────────────────┐   ┌─────────────────────┐   
|                     CAMERA FRAME                         │   │   CAMERA CALIBRATION   │   |         IMU         |   
└──────────────┬─────────────────────────────┬─────────────┘   └────────────┬───────────┘   └──────────┬──────────┘   
			   │                             │                              |                          |              
			   ▼                             ▼                              |                          |              
  ┌──────────────────────────┐  ┌──────────────────────────┐                |                          |              
  │    DEPTH ESTIMATION      │  │     OBJECT DETECTION     │                |                          |              
  └────────────┬─────────────┘  └──────┬─────────────┬─────┘                |                          |                          [Depth Map]          [Class Labels]  [Bounding Boxes]     [fx,fy,cx,cy]                    |              
			   │                       |          |      │                  |                          |              
			   │                       |          |      │                  |                          |              
			   └──────────────┬────────c──────────┘      └───────┬──────────┘      ┌───────────────────┘              
							  │        |                         |                 |                                  
						  [z_depths]   |                    [camera ray]   [roll, pitch, yaw]                         
							  │        |                      |    |               |                                  
							  └────────c──────┬───────────────┘    └─────────┬─────┘                                  
									   |   [range]                       [world_dir]                                  
									   |	  └───────────────┬──────────────┘                                        
									   |				[world points]                                                
									   └───────────┐		  │                                                       
												   │          |                                                       
												   ▼		  ▼                                                       
										  ┌──────────────────────────────────────┐                                    
										  │          GROUND POLAR MAP            │                                    
										  └──────────────────┬───────────────────┘                                    
														[Polar Plot]                                                  
```



# Deep learning Block

Before making sense of the overall scene, the pipeline needs to identify what is in the frame and figure out how far away it actually is. That’s where the deep learning block comes in. The deep learning block is serves as the perception engine, being responsable for the target location and identification and for the depth information recovering from the image. 

## Object Detection


Object detection is a computer vision task used to identify and localize objects within an image or video. Unlike image classification, which assigns a label to an entire image, an object detector searches the image for individual targets and determines where each one is located.

Under the hood, modern object detectors leverage deep neural backbones to extract hierarchical feature maps that are fused across scales to capture multi-scale semantic contexts. During inference, the network processes the image in a single forward pass and simultaneously predicts candidate object locations and classes using specialized detection heads. These predictions are then filtered and refined to produce the final set of detections.

For every detection, the model outputs three main pieces of information:
- Bounding box — The location of the detected object in the image. It is usually given in $$(x_1, y_1, x_2, y_2)$$ format, where each point corresponds to the coordinates of the corners framing the target’s position.
- Class label — The predicted object category, what the model believes the object is. 
- Confidence score — A probabilistic metric that reflects how certain the model is in that prediction.  

As a baseline for this initial implementation I will use RF-DETR, a transformer-based object detection model specialized for real time inference.


OBJECT DETECTION IMAGE!

## Monocular Depth Estimation

Monocular depth estimation is a computer vision task that predicts the per-pixel depth of an image.  

A flat image has no depth cues, the camera has no way of knowing if the pixel it's seeing is a close small or big far object. In fact, there is an infinite combination of three-dimensional physical structures  that can project identical flat two-dimensional images. This problem is called monocular ambiguity. A monocular visual model must rely heavily on contextual cues like perspective, object occlusion, scale and learned visual priors about how the physical world is structured.

Modern depth estimation models resolve this ambiguity using deep neural network architectures that translate visual context into 3D structure. First, a visual backbone processes the image to extract contextual features. A specialized decoder then fuses these high-level semantic features across multiple image resolutions to recover fine structural details and clear boundaries. Finally, a regression head maps these pixel-level representations into a dense depth map. 

There are two main categories for depth estimation:

- Relative depth estimation —  Ranks objects from nearest to farthest on an arbitrary, unitless scale.
- Absolte (Metric) depth estimation — Predicts real-world distances, in meters.

Target mapping requires actual spatial coordinates, so relative estimations fall short. This pipeline strictly demands metric depth.

As a baseline for this project the Depth Anything 3 model will be used (specifically the `da3metric-large` weights) to generate dense, highly accurate metric depth maps across the scene.  Furthermore, the unified spatial understanding that this model provides when presented with multiple images or video frames could be utilized in later iterations of this project.

> **Which pixel's depth represents the object?**
>
> A key detail here is deciding which depth value actually represents a given object. Standard object detectors give us bounding boxes, not precise pixel-level masks like in instance segmentation. For this iteration we will assume the center pixel of the bounding box represents the object, but this breaks down if the object has an unusual pose or a hole right in the middle. With instance segmentation, we could instead calculate the mean depth across all pixels belonging to the object mask, leading to much more accurate measurements.
{: .prompt-warning }


DEPTH ESTIMATION IMAGE!


# Camera Geometry & Spatial Orientation

Once the target's image location and depth are predicted, we need a mathematical framework to transform those predictions into spatial coordinates.


## The Pinhole Model

The pinhole camera model mathematically describes how 3D points project onto a 2D image. However, the Visual Radar application requires the inverse: reconstructing 3D space by unprojecting 2D pixels. Consequently, this section inverts the traditional model while introducing a few simplifications and omissions.

### Camera Coordinate System

We define our 3D reference frame centered at the camera's focal point (the optical center, where all light rays intersect) called the **Camera Coordinate System**. Following standard computer vision conventions:

- $$Z_c$$ (Optical Axis): Points straight ahead into the scene, representing depth.    
- **$$X_c$$:** Points horizontally to the right.    
- **$$Y_c$$:** Points vertically downwards.

In the traditional physical camera model, light projects through the optical center onto a sensor placed behind it, flipping the image. To simplify the math, we place a virtual **normalized image plane** at a fixed distance of $$Z_c = 1$$ in front of the optical center. This removes physical lens dependencies and allows us to work purely with ray directions.

### Pixels as Light Rays

A fundamental shift in mindset for 3D reconstruction is realizing that **a 2D pixel $$(u, v)$$ is not a 3D position—it is a direction vector.** 

Every pixel on your screen corresponds to a unique light ray shooting from the optical center through that pixel's location on the normalized image plane out into the scene.

To convert a pixel coordinate $$(u, v)$$ into a normalized ray direction in camera space, we must invert the camera's internal geometric properties, its **intrinsic matrix ($$K$$)**:

$$K = \begin{bmatrix} f_x & 0 & c_x \\ 0 & f_y & c_y \\ 0 & 0 & 1 \end{bmatrix}$$

Here, $$(c_x, c_y)$$ is the **principal point** (where the optical axis pierces the image plane, usually near the image center), and $$f_x, f_y$$ are the focal lengths expressed in pixel units. Skew is assumed to be zero for modern digital sensors.

For physical cameras, the intrinsic matrix $$K$$ is typically computed via **camera calibration**. When working with virtual cameras or synthetic renderings where the intrinsic matrix $$K$$ is unknown, $$f_x$$ and $$f_y$$ can be derived directly from the camera's horizontal ($$\text{FOV}_h$$ a) and vertical Field of View ($$\text{FOV}_v$$) long with the image dimensions ($$W, H$$):

$$f_x = \frac{W}{2 \cdot \tan\left(\frac{\text{FOV}_h}{2}\right)}\quad \quad f_y = \frac{H}{2 \cdot \tan\left(\frac{\text{FOV}_v}{2}\right)}$$

### Unprojecting Pixels to Normalized Ray Directions

By applying the inverse intrinsic matrix $$K^{-1}$$ to our pixel coordinates in homogeneous form $$[u, v, 1]^T$$, we isolate the normalized ray direction vector $$\vec{r}_{\text{cam}} = [x_{\text{cam}}, y_{\text{cam}}, 1]^{T}$$ on the $$Z=1$$ plane:

$$\large \vec{r}_{\text{cam}} =\begin{bmatrix} x_{\text{cam}} \\ y_{\text{cam}} \\ 1 \end{bmatrix} = K^{-1} \begin{bmatrix} u \\ v \\ 1 \end{bmatrix} = \begin{bmatrix} \frac{u - c_x}{f_x} \\ \frac{v - c_y}{f_y} \\ 1 \end{bmatrix} $$

At this stage, $$\vec{r}_{\text{cam}}$$ tells us the exact direction of the light ray passing through pixel $$(u, v)$$, but we still don't know how far along that ray the object surface lies.

<div style="width: 75%; margin: 0 auto;" markdown="1">
{% include embed/video.html src='/assets/videos/visual_radar/PinholeCameraModel.mp4' title='Pinhole camera model' %}
</div>


## Depth vs Range 

The monocular depth estimation model predicts scalar depth value $$Z$$ for every pixel $$(u, v)$$. Because depth $$Z$$ represents orthogonal distance along the $$Z_c$$ axis, reconstructing the full 3D coordinate $$[X, Y, Z]^T$$ in camera space simply requires scaling our normalized ray by $$Z$$:

$$\begin{bmatrix} X \\ Y \\ Z \end{bmatrix} = Z \cdot \vec{r}_{\text{cam}} = Z \cdot \begin{bmatrix} x_{\text{cam}} \\ y_{\text{cam}} \\ 1 \end{bmatrix} = \begin{bmatrix} Z \cdot \left(\frac{u - c_x}{f_x}\right) \\ Z \cdot \left(\frac{v - c_y}{f_y}\right) \\ Z \end{bmatrix}$$

However, for the Visual Radar application requires the true distance from the optical center to the target point. **Ray Range** measures the Euclidean distance along the actual light ray:

$$\text{range} = Z \cdot \Vert{}\vec{r}_{\text{cam}}\Vert{} = Z \cdot \sqrt{x_{\text{cam}}^2 + y_{\text{cam}}^2 + 1}$$


Understanding the distinction between depth and range is critical for radar visualization: pixels near the edge of a wide-angle image have a significantly higher range than pixels at the center, even if their estimated depth $$Z$$ is identical.



<div style="width: 75%; margin: 0 auto;" markdown="1">
{% include embed/video.html src='/assets/videos/visual_radar/DepthRangeFocalExperiment.mp4' title='' %}
</div>



## From Camera Space to World Space

Up to this point, our reconstructed 3D points $$[X_c, Y_c, Z_c]^T$$ exist strictly in **Camera Space**. While this local coordinate frame tells us where objects are relative to the lens, a practical application like Visual Radar requires placing those points onto a fixed global map.

To bridge this gap, we need to transform our unprojected camera rays into **World Space**. In the forward pinhole model, the **Extrinsic Matrix** $$[\mathbf{R}_{\text{world}\to\text{cam}} \mid \mathbf{t}]$$ moves world points into the camera frame before the intrinsics $$\mathbf{K}$$ project them onto the image. Our pipeline runs in reverse, so we need the inverse rotation, the **Camera Pose Matrix** $$\mathbf{R}_{\text{cam}\to\text{world}}$$. For a rotation the inverse is simply the transpose, $$\mathbf{R}_{\text{cam}\to\text{world}} = \mathbf{R}_{\text{world}\to\text{cam}}^T$$. The translation $$\mathbf{t}$$ plays no role, because we work with ray *directions* and treat the camera as the origin of the radar.

### Camera, Body and World Frames

Camera rays could be directly transformed into world coordinates with a single rotation. However, introducing an intermediate **Body Frame** is practical when working with IMU sensors and pose estimators, which report attitude angles relative to the physical body in navigation conventions.

We work with three distinct coordinate frames:

- **Camera Frame** (attached to the camera, computer vision conventions): $X_c$ points Right, $Y_c$ points Down, $Z_c$ points Forward out of the lens.
- **Body Frame** (attached to the camera, navigation conventions): $X_b$ points Right, $Y_b$ points Forward, $Z_b$ points Up.
- **World Frame** (fixed to the ground, **ENU**): $X_w$ points **East**, $Y_w$ points **North**, $Z_w$ points **Up**.

When the camera body is level and facing North (all attitude angles zero), the body axes align directly with the ENU world axes.

To express camera axes in body axes, we apply an axis-relabeling matrix $\mathbf{C}_{\text{body}}^{\text{cam}}$:

$$\large \begin{bmatrix} X_b \\ Y_b \\ Z_b \end{bmatrix} = \underbrace{\begin{bmatrix} 1 & 0 & 0 \\ 0 & 0 & 1 \\ 0 & -1 & 0 \end{bmatrix}}_{\mathbf{C}_{\text{body}}^{\text{cam}} } \begin{bmatrix} X_c \\ Y_c \\ Z_c \end{bmatrix}$$

### Reorienting the Ray to World Frame

Once expressed in body axes, the ray describes a camera that is level and facing north. To place it in the world, we rotate it by the camera's measured attitude with the following conventions:

- **Yaw ($$\psi$$):** the compass heading, a rotation about the vertical axis. $$0 \equiv$$ North, and positive turns clockwise toward East.
- **Pitch ($$\theta$$):** tilt up or down, a rotation about the camera's right axis. Positive tilts up.
- **Roll ($$\phi$$):** rotation about the camera's forward axis. Positive is clockwise as seen from behind the camera.

$$\mathbf{R}_y(\text{roll}) = \begin{bmatrix} \cos\phi & 0 & \sin\phi \\ 0 & 1 & 0 \\ -\sin\phi & 0 & \cos\phi \end{bmatrix}, \quad \mathbf{R}_x(\text{pitch}) = \begin{bmatrix} 1 & 0 & 0 \\ 0 & \cos\theta & -\sin\theta \\ 0 & \sin\theta & \cos\theta \end{bmatrix}, \quad \mathbf{R}_z(\text{yaw}) = \begin{bmatrix} \cos\psi & \sin\psi & 0 \\ -\sin\psi & \cos\psi & 0 \\ 0 & 0 & 1 \end{bmatrix}$$

These three rotations combine into a single rotation matrix:

$$\mathbf{R}_{\text{body}\to\text{world}} = \mathbf{R}_z(\psi) \cdot \mathbf{R}_x(\theta) \cdot \mathbf{R}_y(\phi)$$

$$\mathbf{R}_x$$ and $$\mathbf{R}_y$$ are the standard right-hand-rule rotations. $$\mathbf{R}_z$$ is the **compass-style** version, the transpose of the standard convention, so that positive yaw turns clockwise like a compass bearing.

> **Two ways to read the same matrix**
>
> Rotations do not commute ($$\mathbf{A} \cdot \mathbf{B} \neq \mathbf{B} \cdot \mathbf{A}$$), so the order in which they are applied matters. There are two equivalent ways to interpret this product:
>
> - **Extrinsic (right to left, fixed world axes rotation):** rotate the ray by **Roll** about $$Y_w$$, then **Pitch** about $$X_w$$, then **Yaw** about $$Z_w$$. This is what the matrix does to the vector, step by step.
> - **Intrinsic (left to right, moving body axes rotation):** turn the camera by **Yaw** to its heading, then **Pitch** it about its own right axis, then **Roll** it about its own viewing direction. This matches how we would physically aim a camera.
>
> Both readings produce the same matrix: **rotations about fixed axes in one order (Yaw $$\rightarrow$$ Pitch $$\rightarrow$$ Roll) equal rotations about moving axes in the reverse order (Roll $$\rightarrow$$ Pitch $$\rightarrow$$ Yaw).**
{: .prompt-info }


<div style="width: 75%; margin: 0 auto;" markdown="1">
{% include embed/video.html src='/assets/videos/visual_radar/CameraOrientationRig.mp4' title='Roll, Pitch, Yaw Demo' %}
</div>


Finally, chaining the axis relabeling with the attitude rotation gives the full Camera Pose Matrix. A ray in the camera frame is first relabeled into body axes by $$\mathbf{C}_{\text{body}}^{\text{cam}}$$, then rotated into the world by $$\mathbf{R}_{\text{body}\to\text{world}}$$: 

$$\vec{d}_{\text{world}} = \underbrace{\mathbf{R}_z(\psi) \cdot \mathbf{R}_x(\theta) \cdot \mathbf{R}_y(\phi) \cdot \mathbf{C}_{\text{body}}^{\text{cam}}}_{\mathbf{R}_{\text{cam}\to\text{world}}} \cdot \vec{r}_{\text{cam}}$$


<div style="width: 75%; margin: 0 auto;" markdown="1">
{% include embed/video.html src='/assets/videos/visual_radar/CameraRayToWorldTransform.mp4' title='' %}
</div>



## Assembling the 3D World Point

The geometric pipeline deliberately decouples **orientation (ray direction)** from **distance (range estimation)**. Once the camera pose matrix $\mathbf{R}_{\text{cam}\to\text{world}}$ maps the normalized camera ray into world space, the ray must be explicitly normalized to unit length before applying the Euclidean range:

$$ \hat{\mathbf{d}}_{\text{world}} = \frac{\vec{d}_{\text{world}}}{\Vert{}\vec{d}_{\text{world}}\Vert{}}$$

Scaling this directional unit vector $$\hat{\mathbf{d}}_{\text{world}}$$ by the true light ray Euclidean distance ($$\text{range}$$) yields the absolute 3D position vector $$\mathbf{P}_{\text{world}} = [X_w, Y_w, Z_w]^T$$:

$$\mathbf{P}_{\text{world}} = \text{range} \cdot \hat{\mathbf{d}}_{\text{world}}$$

## Flattening to 2D Ground Radar (Azimuth & Range)

A standard planar radar screen displays a top-down polar representation of space. Mapping full 3D coordinates $(X_w, Y_w, Z_w)$ onto a 2D radar plane requires projecting the 3D position vector onto the $Z_w = 0$ ground plane by dropping the vertical elevation component.

The resulting 2D ground range represents the orthographic Euclidean projection onto the $X_w\text{-}Y_w$ navigation plane:

$$\text{Range}_{\text{2D}} = \sqrt{X_w^2 + Y_w^2}$$

In radar geometry, **Azimuth** represents the horizontal angular bearing of a target measured across the ground plane, distinct from its vertical elevation angle.

To plot targets on a navigation display, we express this azimuth angle $\theta$ relative to the ENU (East-North-Up) World Frame. Standard mathematical polar coordinates measure angles counterclockwise starting from the $+X_w$ axis (East). Navigation and radar systems instead define azimuth in compass convention: zero degrees ($0^\circ$) aligns directly with **True North ($+Y_w$)**, and positive angles sweep **clockwise toward East ($+X_w$)**.

To enforce this clockwise-from-North navigation convention using Cartesian ENU coordinates, the standard argument order of the two-argument arctangent function is inverted:

$$\theta = \operatorname{atan2}(X_w, Y_w)$$

This yields the complete polar coordinate pair $(\text{Range}_{\text{2D}}, \theta)$, mapping unprojected 2D pixel observations directly into a global radar representation.


<div style="width: 75%; margin: 0 auto;" markdown="1">
{% include embed/video.html src='/assets/videos/visual_radar/WorldToGroundPolar.mp4' title='' %}
</div>



# The Radar Display

Once 3D points are converted into planar range and azimuth coordinates $(\text{Range}_{\text{2D}}, \theta)$, they are mapped onto a radar interface. This interface is made up of the following elements:
 

- **Concentric Range Rings:** Fixed radial grid lines centered at the origin that provide an immediate visual distance scale (e.g., $5\,\text{m}, 10\,\text{m}, 20\,\text{m}$ intervals).

- **Camera Field-of-View (FOV) Wedge:** A shaded angular sector originating from the camera location that delineates the horizontal optical boundaries ($\text{FOV}_h$). It shows the camera's current line of sight.

- **Class-Colored Detections:** Each detected target is plotted as a discrete point with a color asigned by its predicted class. A legend showing the class color relationship in show in the rendered plot.

- **Compass**: Indicates direction relative to the global grid.

Radar visualizations use one of two vertical display orientations depending on whether the rendering frame aligns with the cameras's body or the global navigation grid:

 - World-Referenced View: The global compass grid remains fixed. As the camera's attitude changes, the FOV wedge rotates around the center origin to indicate the camera's current heading relative to the world. This view makes it easy to match radar positions directly with maps or GIS layers.

- Ego-Centric View: The camera's FOV wedge remains locked vertically at $0^\circ$, pointing straight ahead. As the camera turns, the surrounding world and global compass directions rotate around the origin. This mirrors the operator's forward viewpoint, making it more intuitive to compare radar positions to what is visible through the camera lens.

![World-referenced and ego-centric radar views](/assets/img/visual_radar/radar_world_ego_views.png){: w="700" }
_Visual Radar display example. **person** class detection at $$R = 40\,\text{m}$$ and $$\theta = -90^\circ$$. a) World-Referenced View b) Ego-Centric View_



# Issues and Limitations


# Future work