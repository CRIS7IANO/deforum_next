# Roll Channel (v10)

Camera transform supports an optional `roll_deg` channel.

- In the viewport, rotate gizmo can write `roll_deg` at the current frame.
- The camera rig applies roll in degrees to the look-at quaternion before optional HorizonLock.

This roll is exported through `rotation_3d_x/y/z` schedules via the camera quaternion.
